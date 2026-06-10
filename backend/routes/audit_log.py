"""Manager-only audit log: newest-first list of audit_events."""
from flask import Blueprint, jsonify, request

from audit import _ensure_table
from db import get_db
from permissions import manager_required

bp = Blueprint("audit_log", __name__)


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
        rows = db.execute(
            "SELECT * FROM audit_events ORDER BY id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
    return jsonify([dict(r) for r in rows])
