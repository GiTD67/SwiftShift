from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from db import get_db

bp = Blueprint("users", __name__)


@bp.route("/api/users", methods=["GET"])
def list_users():
    with get_db() as db:
        rows = db.execute(
            "SELECT id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary FROM users ORDER BY id"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/users", methods=["POST"])
def create_user():
    data = request.get_json() or {}
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")
    if not first_name or not last_name or not email:
        return jsonify({"error": "first_name, last_name, email required"}), 400
    if not password:
        return jsonify({"error": "password required"}), 400
    pw_hash = generate_password_hash(password)
    with get_db() as db:
        try:
            row = db.execute(
                """INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime)
                   VALUES (?, ?, ?, ?, 1)
                   RETURNING id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary""",
                (first_name, last_name, email, pw_hash),
            ).fetchone()
            db.commit()
        except Exception:
            return jsonify({"error": "email already exists"}), 409
    return jsonify(dict(row)), 201


@bp.route("/api/users/<int:uid>", methods=["GET"])
def get_user(uid):
    with get_db() as db:
        row = db.execute(
            "SELECT id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary FROM users WHERE id = ?",
            (uid,),
        ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(dict(row))


@bp.route("/api/users/<int:uid>", methods=["PUT"])
def update_user(uid):
    data = request.get_json() or {}
    allowed = {"job_role", "manager_name", "is_fulltime", "pay", "salary"}
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return jsonify({"error": "no updatable fields provided"}), 400
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [uid]
    with get_db() as db:
        db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
        db.commit()
        row = db.execute(
            "SELECT id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary FROM users WHERE id = ?",
            (uid,),
        ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(dict(row))


@bp.route("/api/users/<int:uid>", methods=["DELETE"])
def delete_user(uid):
    with get_db() as db:
        row = db.execute("SELECT id FROM users WHERE id = ?", (uid,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        db.execute("DELETE FROM users WHERE id = ?", (uid,))
        db.commit()
    return jsonify({"ok": True})
