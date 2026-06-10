"""Manager-only audit log: newest-first list of audit_events."""
from flask import Blueprint, jsonify, request

from audit import _ensure_table
from db import get_db
from permissions import current_uid, manager_required

bp = Blueprint("audit_log", __name__)


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


# GET /api/audit?limit=&offset=
@bp.route("/api/audit", methods=["GET"])
def list_events():
    err = manager_required()
    if err:
        return err
    try:
        limit = max(1, min(int(request.args.get("limit", 100)), 500))
    except (TypeError, ValueError):
        limit = 100
    try:
        offset = max(0, int(request.args.get("offset", 0)))
    except (TypeError, ValueError):
        offset = 0
    with get_db() as db:
        _ensure_table(db)
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            # Company managers only see events from their own company's users.
            rows = db.execute(
                "SELECT * FROM audit_events"
                " WHERE user_id IN (SELECT id FROM users WHERE company_id = ?)"
                " ORDER BY id DESC LIMIT ? OFFSET ?",
                (viewer_company, limit, offset),
            ).fetchall()
        else:
            # Legacy pre-company managers keep the original global list.
            rows = db.execute(
                "SELECT * FROM audit_events ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
    return jsonify([dict(r) for r in rows])
