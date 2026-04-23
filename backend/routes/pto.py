from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("pto", __name__)


def _ensure_tables():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS pto_balances (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL,
                hours_balance REAL DEFAULT 0.0,
                updated_at TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS pto_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                hours REAL NOT NULL,
                reason TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        db.commit()


try:
    _ensure_tables()
except Exception:
    pass


@bp.route("/api/pto/balance", methods=["GET"])
def get_balance():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM pto_balances WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row:
        return jsonify(dict(row))
    return jsonify({"user_id": int(user_id), "hours_balance": 0.0})


@bp.route("/api/pto/accrue", methods=["POST"])
def accrue():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    hours = float(data.get("hours", 0))
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM pto_balances WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing:
            new_balance = float(existing["hours_balance"]) + hours
            db.execute(
                "UPDATE pto_balances SET hours_balance = ?, updated_at = ? WHERE user_id = ?",
                (new_balance, now, user_id),
            )
        else:
            new_balance = hours
            db.execute(
                "INSERT INTO pto_balances (user_id, hours_balance, updated_at) VALUES (?, ?, ?)",
                (user_id, hours, now),
            )
        db.commit()
    return jsonify({"user_id": int(user_id), "hours_balance": new_balance})


@bp.route("/api/pto/deduct", methods=["POST"])
def deduct():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    hours = float(data.get("hours", 0))
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM pto_balances WHERE user_id = ?", (user_id,)
        ).fetchone()
        current = float(existing["hours_balance"]) if existing else 0.0
        new_balance = max(0.0, current - hours)
        if existing:
            db.execute(
                "UPDATE pto_balances SET hours_balance = ?, updated_at = ? WHERE user_id = ?",
                (new_balance, now, user_id),
            )
        else:
            db.execute(
                "INSERT INTO pto_balances (user_id, hours_balance, updated_at) VALUES (?, ?, ?)",
                (user_id, new_balance, now),
            )
        db.commit()
    return jsonify({"user_id": int(user_id), "hours_balance": new_balance})


@bp.route("/api/pto/requests", methods=["GET"])
def list_requests():
    user_id = request.args.get("user_id")
    with get_db() as db:
        if user_id:
            rows = db.execute(
                "SELECT * FROM pto_requests WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM pto_requests ORDER BY created_at DESC"
            ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/pto/requests", methods=["POST"])
def create_request():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    hours = float(data.get("hours", 0))
    reason = data.get("reason", "")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute(
            "INSERT INTO pto_requests (user_id, hours, reason, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?) RETURNING *",
            (user_id, hours, reason, now, now),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


@bp.route("/api/pto/requests/<int:req_id>", methods=["PUT"])
def update_request(req_id):
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("approved", "denied", "pending"):
        return jsonify({"error": "invalid status"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        db.execute(
            "UPDATE pto_requests SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, req_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
    return jsonify(dict(row))
