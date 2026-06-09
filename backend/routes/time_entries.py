from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("time_entries", __name__)


@bp.route("/api/time-entries", methods=["GET"])
def list_time_entries():
    employee_id = request.args.get("employee_id")
    with get_db() as db:
        if employee_id:
            rows = db.execute(
                "SELECT * FROM time_entries WHERE employee_id = ? ORDER BY date DESC, start_time DESC",
                (employee_id,),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM time_entries ORDER BY date DESC, start_time DESC"
            ).fetchall()
    return jsonify([dict(r) for r in rows])


def _compute_duration(start_time: str, end_time: str) -> int:
    try:
        s = datetime.strptime(start_time, "%H:%M")
        e = datetime.strptime(end_time, "%H:%M")
        result = int((e - s).total_seconds() / 60)
        if result < 0:
            result += 24 * 60
        return result
    except Exception:
        return 0


@bp.route("/api/time-entries", methods=["POST"])
def create_time_entry():
    data = request.get_json() or {}
    required = ["date", "start_time", "end_time"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} required"}), 400
    employee_id = data.get("employee_id")
    duration = data.get("duration_minutes")
    if duration is None:
        duration = _compute_duration(data["start_time"], data["end_time"])
    with get_db() as db:
        cur = db.execute(
            """INSERT INTO time_entries
               (employee_id, date, project, task, start_time, end_time, duration_minutes, description)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                employee_id,
                data["date"],
                data.get("project"),
                data.get("task"),
                data["start_time"],
                data["end_time"],
                duration,
                data.get("description"),
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM time_entries WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201
