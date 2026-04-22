from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("employees", __name__)


@bp.route("/api/employees", methods=["GET"])
def list_employees():
    with get_db() as db:
        rows = db.execute("SELECT * FROM employees ORDER BY id").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/employees", methods=["POST"])
def create_employee():
    data = request.get_json() or {}
    name = data.get("name")
    email = data.get("email")
    if not name:
        return jsonify({"error": "name required"}), 400
    with get_db() as db:
        cur = db.execute("INSERT INTO employees (name, email) VALUES (?, ?)", (name, email))
        db.commit()
        emp = db.execute("SELECT * FROM employees WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(emp)), 201
