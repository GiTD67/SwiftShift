from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db
from permissions import current_uid, manager_required

bp = Blueprint("employees", __name__)


@bp.route("/api/employees", methods=["GET"])
def list_employees():
    with get_db() as db:
        rows = db.execute("SELECT * FROM employees ORDER BY id").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/employees", methods=["POST"])
def create_employee():
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    name = data.get("name")
    email = data.get("email")
    if not name:
        return jsonify({"error": "name required"}), 400
    with get_db() as db:
        cur = db.execute("INSERT INTO employees (name, email) VALUES (?, ?)", (name, email))
        db.commit()
        emp = db.execute("SELECT * FROM employees WHERE id = ?", (cur.lastrowid,)).fetchone()
    if not emp:
        return jsonify({"error": "failed to create employee"}), 500
    return jsonify(dict(emp)), 201


@bp.route("/api/employees/enter_time", methods=["POST"])
def enter_time():
    data = request.get_json() or {}
    employee_id = current_uid()  # always clock in as yourself
    if not employee_id:
        return jsonify({"error": "authentication required"}), 401
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute(
            "INSERT INTO clock_sessions (employee_id, clock_in, notes) VALUES (?, ?, ?) RETURNING *",
            (employee_id, now, data.get("notes")),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


@bp.route("/api/employees/exit_time", methods=["POST"])
def exit_time():
    data = request.get_json() or {}
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        if row["employee_id"] != current_uid():
            return jsonify({"error": "forbidden"}), 403
        if row["clock_out"]:
            return jsonify({"error": "already clocked out"}), 400
        try:
            clock_in = datetime.fromisoformat(row["clock_in"])
        except (TypeError, ValueError):
            return jsonify({"error": "session has an invalid clock-in time"}), 409
        duration = max(0, int((datetime.utcnow() - clock_in).total_seconds() / 60))
        db.execute(
            "UPDATE clock_sessions SET clock_out = ?, duration_minutes = ? WHERE id = ?",
            (now, duration, session_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
    return jsonify(dict(row))
