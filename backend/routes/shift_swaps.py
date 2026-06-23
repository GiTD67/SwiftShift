from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from audit import log_event
from db import get_db
from permissions import current_uid, manager_required
from routes.org_settings import get_org_settings

bp = Blueprint("shift_swaps", __name__)

_DDL = """
CREATE TABLE IF NOT EXISTS shift_swaps (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL,
  target_id INTEGER,
  shift_date TEXT NOT NULL,
  shift_start TEXT NOT NULL,
  shift_end TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
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


# GET /api/shift-swaps?user_id=X&status=open
@bp.route("/api/shift-swaps", methods=["GET"])
def list_swaps():
    # A `user_id` query param means "scope to me" - but the identity always comes
    # from the session, never the client-supplied value, so you can't read another
    # user's swaps by changing the id. Omitting it lists all (for the manager hub).
    scope_to_me = request.args.get("user_id") is not None
    uid = current_uid()
    status = request.args.get("status")
    with get_db() as db:
        _ensure_table(db)
        where = []
        params = []
        if scope_to_me:
            where.append("(requester_id = ? OR target_id = ?)")
            params.extend([uid, uid])
        else:
            # Company-scope the global list: a non-legacy viewer only sees swaps
            # involving users of their own company (requester or target - same
            # membership rule as export.py). Legacy viewers (company_id NULL)
            # keep the global list.
            viewer_company = _viewer_company_id(db, uid)
            if viewer_company is not None:
                where.append(
                    "(requester_id IN (SELECT id FROM users WHERE company_id = ?)"
                    " OR target_id IN (SELECT id FROM users WHERE company_id = ?))"
                )
                params.extend([viewer_company, viewer_company])
        if status:
            where.append("status = ?")
            params.append(status)
        sql = "SELECT * FROM shift_swaps"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY shift_date DESC"
        rows = db.execute(sql, params).fetchall()
    return jsonify([dict(r) for r in rows])


# POST /api/shift-swaps
@bp.route("/api/shift-swaps", methods=["POST"])
def create_swap():
    data = request.get_json() or {}
    requester_id = current_uid()  # identity from the session, never the client body
    shift_date = data.get("shift_date")
    shift_start = data.get("shift_start")
    shift_end = data.get("shift_end")
    if not all([requester_id, shift_date, shift_start, shift_end]):
        return jsonify({"error": "shift_date, shift_start, shift_end required"}), 400

    status = "open"
    reviewed_at = None
    target_id = data.get("target_id")
    with get_db() as db:
        _ensure_table(db)
        requester_company = _viewer_company_id(db, requester_id)
        # A non-legacy requester may only name a target inside their own company.
        # Legacy requesters (company_id NULL) keep the original unscoped behavior.
        if target_id and requester_company is not None:
            target = db.execute(
                "SELECT company_id FROM users WHERE id = ?", (target_id,)
            ).fetchone()
            if not target or target["company_id"] != requester_company:
                return jsonify({"error": "target user not found"}), 404
        # Auto-approve when the org setting is on, both employees agreed (a target
        # was named), and the shift starts far enough in the future.
        if target_id:
            min_hours = get_org_settings(db, requester_company).get("auto_approve_swap_hours")
            if min_hours is not None:
                try:
                    shift_dt = datetime.fromisoformat(f"{shift_date}T{shift_start}")
                except ValueError:
                    shift_dt = None
                if shift_dt and shift_dt - datetime.utcnow() >= timedelta(hours=float(min_hours)):
                    status = "accepted"
                    reviewed_at = datetime.utcnow().isoformat()
        row = db.execute(
            """
            INSERT INTO shift_swaps (requester_id, target_id, shift_date, shift_start, shift_end, reason, status, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            (
                requester_id,
                target_id,
                shift_date,
                shift_start,
                shift_end,
                data.get("reason"),
                status,
                reviewed_at,
            ),
        ).fetchone()
        db.commit()
    log_event(requester_id, None, "swap_create", f"Requested shift swap for {shift_date} ({shift_start}-{shift_end})")
    if status == "accepted":
        log_event(requester_id, None, "swap_auto_approve", f"Shift swap #{row['id']} ({shift_date}) auto-approved by workflow settings")
    return jsonify(dict(row)), 201


# PUT /api/shift-swaps/:id
@bp.route("/api/shift-swaps/<int:swap_id>", methods=["PUT"])
def update_swap(swap_id):
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("open", "accepted", "denied", "cancelled"):
        return jsonify({"error": "status must be open, accepted, denied, or cancelled"}), 400

    now = datetime.utcnow().isoformat()
    with get_db() as db:
        _ensure_table(db)
        row = db.execute("SELECT id, requester_id, target_id FROM shift_swaps WHERE id = ?", (swap_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        # A non-legacy manager can only act on swaps involving their own
        # company (requester or target - same membership rule as list_swaps
        # and export.py); cross-company swaps look like 404. Legacy callers
        # (company_id NULL) keep the original global behavior.
        caller_company = _viewer_company_id(db, current_uid())
        if caller_company is not None:
            member = db.execute(
                "SELECT 1 FROM users WHERE id IN (?, ?) AND company_id = ?",
                (row["requester_id"], row["target_id"], caller_company),
            ).fetchone()
            if not member:
                return jsonify({"error": "not found"}), 404
        db.execute(
            "UPDATE shift_swaps SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (status, current_uid(), now, swap_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM shift_swaps WHERE id = ?", (swap_id,)).fetchone()
    if status in ("accepted", "denied"):
        log_event(
            current_uid(), None,
            "swap_approve" if status == "accepted" else "swap_deny",
            f"Shift swap #{swap_id} ({row['shift_date']}, user #{row['requester_id']}) {status}",
        )
    return jsonify(dict(row))
