from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db

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


# GET /api/shift-swaps?user_id=X&status=open
@bp.route("/api/shift-swaps", methods=["GET"])
def list_swaps():
    user_id = request.args.get("user_id")
    status = request.args.get("status")
    with get_db() as db:
        _ensure_table(db)
        where = []
        params = []
        if user_id:
            where.append("(requester_id = ? OR target_id = ?)")
            params.extend([user_id, user_id])
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
    requester_id = data.get("requester_id")
    shift_date = data.get("shift_date")
    shift_start = data.get("shift_start")
    shift_end = data.get("shift_end")
    if not all([requester_id, shift_date, shift_start, shift_end]):
        return jsonify({"error": "requester_id, shift_date, shift_start, shift_end required"}), 400

    with get_db() as db:
        _ensure_table(db)
        row = db.execute(
            """
            INSERT INTO shift_swaps (requester_id, target_id, shift_date, shift_start, shift_end, reason)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            (
                requester_id,
                data.get("target_id"),
                shift_date,
                shift_start,
                shift_end,
                data.get("reason"),
            ),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


# PUT /api/shift-swaps/:id
@bp.route("/api/shift-swaps/<int:swap_id>", methods=["PUT"])
def update_swap(swap_id):
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("open", "accepted", "denied", "cancelled"):
        return jsonify({"error": "status must be open, accepted, denied, or cancelled"}), 400

    now = datetime.utcnow().isoformat()
    with get_db() as db:
        _ensure_table(db)
        row = db.execute("SELECT id FROM shift_swaps WHERE id = ?", (swap_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        db.execute(
            "UPDATE shift_swaps SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (status, data.get("reviewed_by"), now, swap_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM shift_swaps WHERE id = ?", (swap_id,)).fetchone()
    return jsonify(dict(row))
