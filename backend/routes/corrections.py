from datetime import datetime

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


def _parse_iso(value):
    """Parse an ISO timestamp string, returning a datetime or None."""
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


# POST /api/corrections — employee requests a fix to one of their own completed sessions
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
            (uid, session_id, new_in.isoformat(), new_out.isoformat(), data.get("reason")),
        ).fetchone()
        db.commit()
    log_event(uid, None, "correction_request", f"Requested time correction for session #{session_id}")
    return jsonify(dict(row)), 201


# GET /api/corrections/mine — the caller's own correction requests
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


# GET /api/corrections/pending — manager review queue (includes current session times)
@bp.route("/api/corrections/pending", methods=["GET"])
def pending_corrections():
    err = manager_required()
    if err:
        return err
    with get_db() as db:
        _ensure_table(db)
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


# POST /api/corrections/:id/approve — manager approves and the session row is updated
@bp.route("/api/corrections/<int:req_id>/approve", methods=["POST"])
def approve_correction(req_id):
    err = manager_required()
    if err:
        return err
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        _ensure_table(db)
        row = db.execute("SELECT * FROM clock_correction_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
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
            (new_in.isoformat(), new_out.isoformat(), net_minutes, row["session_id"]),
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
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        _ensure_table(db)
        row = db.execute("SELECT * FROM clock_correction_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
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
