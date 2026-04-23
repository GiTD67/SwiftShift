from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("availability", __name__)


def _ensure_tables():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS work_availability (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL,
                availability_json TEXT DEFAULT '{}',
                updated_at TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS direct_deposit (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL,
                bank_name TEXT,
                account_type TEXT,
                routing_number TEXT,
                account_number TEXT,
                updated_at TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS work_schedule_template (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE NOT NULL,
                work_start TEXT DEFAULT '09:00',
                work_end TEXT DEFAULT '17:00',
                work_days TEXT DEFAULT '[1,2,3,4,5]',
                updated_at TEXT
            )
        """)
        db.commit()


try:
    _ensure_tables()
except Exception:
    pass


@bp.route("/api/availability", methods=["GET"])
def get_availability():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM work_availability WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row:
        return jsonify(dict(row))
    return jsonify({"user_id": int(user_id), "availability_json": "{}"})


@bp.route("/api/availability", methods=["PUT"])
def set_availability():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    availability_json = data.get("availability_json", "{}")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM work_availability WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing:
            db.execute(
                "UPDATE work_availability SET availability_json = ?, updated_at = ? WHERE user_id = ?",
                (availability_json, now, user_id),
            )
        else:
            db.execute(
                "INSERT INTO work_availability (user_id, availability_json, updated_at) VALUES (?, ?, ?)",
                (user_id, availability_json, now),
            )
        db.commit()
        row = db.execute(
            "SELECT * FROM work_availability WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row))


@bp.route("/api/direct-deposit", methods=["GET"])
def get_direct_deposit():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM direct_deposit WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row:
        d = dict(row)
        # Mask account number
        if d.get("account_number") and len(d["account_number"]) > 4:
            d["account_number_masked"] = "****" + d["account_number"][-4:]
        return jsonify(d)
    return jsonify({"user_id": int(user_id)})


@bp.route("/api/direct-deposit", methods=["PUT"])
def set_direct_deposit():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    now = datetime.utcnow().isoformat()
    fields = ["bank_name", "account_type", "routing_number", "account_number"]
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM direct_deposit WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing:
            sets = ", ".join(f"{f} = ?" for f in fields)
            db.execute(
                f"UPDATE direct_deposit SET {sets}, updated_at = ? WHERE user_id = ?",
                [data.get(f, "") for f in fields] + [now, user_id],
            )
        else:
            cols = ", ".join(fields)
            placeholders = ", ".join(["?"] * len(fields))
            db.execute(
                f"INSERT INTO direct_deposit (user_id, {cols}, updated_at) VALUES (?, {placeholders}, ?)",
                [user_id] + [data.get(f, "") for f in fields] + [now],
            )
        db.commit()
        row = db.execute(
            "SELECT * FROM direct_deposit WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row))


@bp.route("/api/work-schedule", methods=["GET"])
def get_work_schedule():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM work_schedule_template WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row:
        return jsonify(dict(row))
    return jsonify({"user_id": int(user_id), "work_start": "09:00", "work_end": "17:00", "work_days": "[1,2,3,4,5]"})


@bp.route("/api/work-schedule", methods=["PUT"])
def set_work_schedule():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    now = datetime.utcnow().isoformat()
    work_start = data.get("work_start", "09:00")
    work_end = data.get("work_end", "17:00")
    work_days = data.get("work_days", "[1,2,3,4,5]")
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM work_schedule_template WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing:
            db.execute(
                "UPDATE work_schedule_template SET work_start = ?, work_end = ?, work_days = ?, updated_at = ? WHERE user_id = ?",
                (work_start, work_end, work_days, now, user_id),
            )
        else:
            db.execute(
                "INSERT INTO work_schedule_template (user_id, work_start, work_end, work_days, updated_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, work_start, work_end, work_days, now),
            )
        db.commit()
        row = db.execute(
            "SELECT * FROM work_schedule_template WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row))
