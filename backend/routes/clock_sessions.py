from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("clock_sessions", __name__)


@bp.route("/api/clock-sessions", methods=["GET"])
def list_clock_sessions():
    employee_id = request.args.get("employee_id")
    active_only = request.args.get("active") == "1"
    with get_db() as db:
        sql = "SELECT * FROM clock_sessions"
        params = []
        where = []
        if employee_id:
            where.append("employee_id = ?")
            params.append(employee_id)
        if active_only:
            where.append("clock_out IS NULL")
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY clock_in DESC"
        rows = db.execute(sql, params).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/clock-sessions", methods=["POST"])
def clock_in():
    data = request.get_json() or {}
    employee_id = data.get("employee_id")
    if not employee_id:
        return jsonify({"error": "employee_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute(
            "INSERT INTO clock_sessions (employee_id, clock_in, notes) VALUES (?, ?, ?) RETURNING *",
            (employee_id, now, data.get("notes")),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


def _compute_session_duration(clock_in_str: str) -> int:
    clock_in = datetime.fromisoformat(clock_in_str)
    return int((datetime.utcnow() - clock_in).total_seconds() / 60)


@bp.route("/api/clock-sessions/<int:session_id>", methods=["PUT"])
def clock_out(session_id):
    data = request.get_json() or {}
    unpaid_break_minutes = int(data.get("break_minutes", 0) or 0)
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        if row["clock_out"]:
            return jsonify({"error": "already clocked out"}), 400
        total_minutes = _compute_session_duration(row["clock_in"])
        net_minutes = max(0, total_minutes - unpaid_break_minutes)
        db.execute(
            "UPDATE clock_sessions SET clock_out = ?, duration_minutes = ?, break_minutes = ? WHERE id = ?",
            (now, net_minutes, unpaid_break_minutes, session_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
    return jsonify(dict(row))
