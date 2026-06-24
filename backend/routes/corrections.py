from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from audit import log_event
from db import get_db
from permissions import current_uid, manager_required

bp = Blueprint("corrections", __name__)

_DDL = """
CREATE TABLE IF NOT EXISTS clock_correction_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id INTEGER NOT NULL,
  proposed_clock_in TEXT NOT NULL,
  proposed_clock_out TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  reviewed_at TEXT
)
"""


def _ensure_table(db):
    db.execute(_DDL)


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


def _parse_iso(value):
    """Parse an ISO timestamp string, returning a datetime or None."""
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _to_naive_utc(dt):
    """Coerce a datetime to naive UTC for storage in clock_sessions.

    clock_sessions stores every timestamp as a NAIVE UTC string, and the
    duration math in clock_sessions.py subtracts a naive UTC "now" from
    datetime.fromisoformat(stored). Writing an offset-aware value (e.g. a
    proposed time parsed from a '+00:00'/'Z' string) would make that subtraction
    raise "can't subtract offset-naive and offset-aware datetimes". A naive
    input is returned unchanged."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


# POST /api/corrections - employee requests a fix to one of their own completed sessions
@bp.route("/api/corrections", methods=["POST"])
def create_correction():
    data = request.get_json() or {}
    uid = current_uid()
    session_id = data.get("session_id")
    proposed_clock_in = data.get("proposed_clock_in")
    proposed_clock_out = data.get("proposed_clock_out")
    if not all([uid, session_id, proposed_clock_in, proposed_clock_out]):
        return jsonify({"error": "session_id, proposed_clock_in, proposed_clock_out required"}), 400

    new_in = _parse_iso(proposed_clock_in)
    new_out = _parse_iso(proposed_clock_out)
    if not new_in or not new_out:
        return jsonify({"error": "proposed times must be ISO timestamps"}), 400
    if new_out <= new_in:
        return jsonify({"error": "proposed_clock_out must be after proposed_clock_in"}), 400

    with get_db() as db:
        _ensure_table(db)
        sess = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
        if not sess:
            return jsonify({"error": "session not found"}), 404
        if sess["employee_id"] != uid:
            return jsonify({"error": "you can only request corrections to your own sessions"}), 403
        if not sess["clock_out"]:
            return jsonify({"error": "only completed sessions can be corrected"}), 400

        row = db.execute(
            """
            INSERT INTO clock_correction_requests (user_id, session_id, proposed_clock_in, proposed_clock_out, reason)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *
            """,
            (uid, session_id, _to_naive_utc(new_in).isoformat(), _to_naive_utc(new_out).isoformat(), data.get("reason")),
        ).fetchone()
        db.commit()
    log_event(uid, None, "correction_request", f"Requested time correction for session #{session_id}")
    return jsonify(dict(row)), 201


# GET /api/corrections/mine - the caller's own correction requests
@bp.route("/api/corrections/mine", methods=["GET"])
def my_corrections():
    uid = current_uid()
    with get_db() as db:
        _ensure_table(db)
        rows = db.execute(
            "SELECT * FROM clock_correction_requests WHERE user_id = ? ORDER BY created_at DESC",
            (uid,),
        ).fetchall()
    return jsonify([dict(r) for r in rows])


# GET /api/corrections/pending - manager review queue (includes current session times)
@bp.route("/api/corrections/pending", methods=["GET"])
def pending_corrections():
    err = manager_required()
    if err:
        return err
    with get_db() as db:
        _ensure_table(db)
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            # Company managers only see their own company's correction requests.
            rows = db.execute(
                """
                SELECT c.*, s.clock_in AS current_clock_in, s.clock_out AS current_clock_out
                FROM clock_correction_requests c
                LEFT JOIN clock_sessions s ON s.id = c.session_id
                JOIN users u ON u.id = c.user_id
                WHERE c.status = 'pending' AND u.company_id = ?
                ORDER BY c.created_at DESC
                """,
                (viewer_company,),
            ).fetchall()
        else:
            # Legacy pre-company managers keep the original global behavior.
            rows = db.execute(
                """
                SELECT c.*, s.clock_in AS current_clock_in, s.clock_out AS current_clock_out
                FROM clock_correction_requests c
                LEFT JOIN clock_sessions s ON s.id = c.session_id
                WHERE c.status = 'pending'
                ORDER BY c.created_at DESC
                """
            ).fetchall()
    return jsonify([dict(r) for r in rows])


# POST /api/corrections/:id/approve - manager approves and the session row is updated
@bp.route("/api/corrections/<int:req_id>/approve", methods=["POST"])
def approve_correction(req_id):
    err = manager_required()
    if err:
        return err
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    with get_db() as db:
        _ensure_table(db)
        row = db.execute("SELECT * FROM clock_correction_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        # Company managers may only review their own company's requests
        # (same scoping as users.py update_user); legacy NULL-company
        # callers keep the original global behavior.
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            owner = db.execute(
                "SELECT company_id FROM users WHERE id = ?", (row["user_id"],)
            ).fetchone()
            if not owner or owner["company_id"] != viewer_company:
                return jsonify({"error": "not found"}), 404
        if row["status"] != "pending":
            return jsonify({"error": "only pending requests can be reviewed"}), 400
        sess = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (row["session_id"],)).fetchone()
        if not sess:
            return jsonify({"error": "clock session no longer exists"}), 404

        # Apply the proposed times to the real session and recompute its duration
        # (net of the unpaid break minutes already recorded on the session).
        new_in = _parse_iso(row["proposed_clock_in"])
        new_out = _parse_iso(row["proposed_clock_out"])
        break_minutes = int(sess["break_minutes"] or 0)
        total_minutes = int((new_out - new_in).total_seconds() / 60)
        net_minutes = max(0, total_minutes - break_minutes)
        db.execute(
            "UPDATE clock_sessions SET clock_in = ?, clock_out = ?, duration_minutes = ? WHERE id = ?",
            (_to_naive_utc(new_in).isoformat(), _to_naive_utc(new_out).isoformat(), net_minutes, row["session_id"]),
        )
        db.execute(
            "UPDATE clock_correction_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (current_uid(), now, req_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM clock_correction_requests WHERE id = ?", (req_id,)).fetchone()
    log_event(
        current_uid(), None, "correction_approve",
        f"Time correction #{req_id} (session #{row['session_id']}, user #{row['user_id']}) approved",
    )
    return jsonify(dict(row))


# POST /api/corrections/:id/deny
@bp.route("/api/corrections/<int:req_id>/deny", methods=["POST"])
def deny_correction(req_id):
    err = manager_required()
    if err:
        return err
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    with get_db() as db:
        _ensure_table(db)
        row = db.execute("SELECT * FROM clock_correction_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        # Same cross-company guard as approve_correction: company managers
        # may only review their own company's requests; legacy NULL-company
        # callers keep the original global behavior.
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            owner = db.execute(
                "SELECT company_id FROM users WHERE id = ?", (row["user_id"],)
            ).fetchone()
            if not owner or owner["company_id"] != viewer_company:
                return jsonify({"error": "not found"}), 404
        if row["status"] != "pending":
            return jsonify({"error": "only pending requests can be reviewed"}), 400
        db.execute(
            "UPDATE clock_correction_requests SET status = 'denied', reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (current_uid(), now, req_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM clock_correction_requests WHERE id = ?", (req_id,)).fetchone()
    log_event(
        current_uid(), None, "correction_deny",
        f"Time correction #{req_id} (session #{row['session_id']}, user #{row['user_id']}) denied",
    )
    return jsonify(dict(row))
