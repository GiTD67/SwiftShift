from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("availability", __name__)

_DDL = [
    """
    CREATE TABLE IF NOT EXISTS work_availability (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      monday TEXT DEFAULT 'available',
      tuesday TEXT DEFAULT 'available',
      wednesday TEXT DEFAULT 'available',
      thursday TEXT DEFAULT 'available',
      friday TEXT DEFAULT 'available',
      saturday TEXT DEFAULT 'unavailable',
      sunday TEXT DEFAULT 'unavailable',
      preferred_start TEXT DEFAULT '09:00',
      preferred_end TEXT DEFAULT '17:00',
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS direct_deposit (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      bank_name TEXT,
      routing_number TEXT,
      account_number TEXT,
      account_type TEXT DEFAULT 'checking',
      updated_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS work_schedule_template (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      schedule_type TEXT DEFAULT 'full_time',
      hours_per_week REAL DEFAULT 40,
      shift_start TEXT DEFAULT '09:00',
      shift_end TEXT DEFAULT '17:00',
      work_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      updated_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
    """,
]


def _ensure_tables(db):
    for ddl in _DDL:
        db.execute(ddl)


# ── Work Availability ─────────────────────────────────────────────────────────

@bp.route("/api/availability", methods=["GET"])
def get_availability():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute(
            "SELECT * FROM work_availability WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row) if row else {})


@bp.route("/api/availability", methods=["PUT"])
def upsert_availability():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    allowed = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
               "preferred_start", "preferred_end", "notes"}
    fields = {k: v for k, v in data.items() if k in allowed}

    with get_db() as db:
        _ensure_tables(db)
        existing = db.execute(
            "SELECT id FROM work_availability WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing:
            if fields:
                set_clause = ", ".join(f"{k} = ?" for k in fields)
                set_clause += ", updated_at = NOW()::text"
                db.execute(
                    f"UPDATE work_availability SET {set_clause} WHERE user_id = ?",
                    list(fields.values()) + [user_id],
                )
        else:
            cols = ["user_id"] + list(fields.keys())
            vals = [user_id] + list(fields.values())
            db.execute(
                f"INSERT INTO work_availability ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                vals,
            )
        db.commit()
        row = db.execute(
            "SELECT * FROM work_availability WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row))


# ── Direct Deposit ────────────────────────────────────────────────────────────

@bp.route("/api/direct-deposit", methods=["GET"])
def get_direct_deposit():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute(
            "SELECT id, user_id, bank_name, account_type, updated_at FROM direct_deposit WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    return jsonify(dict(row) if row else {})


@bp.route("/api/direct-deposit", methods=["PUT"])
def upsert_direct_deposit():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    allowed = {"bank_name", "routing_number", "account_number", "account_type"}
    fields = {k: v for k, v in data.items() if k in allowed}

    with get_db() as db:
        _ensure_tables(db)
        existing = db.execute(
            "SELECT id FROM direct_deposit WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing:
            if fields:
                set_clause = ", ".join(f"{k} = ?" for k in fields)
                set_clause += ", updated_at = NOW()::text"
                db.execute(
                    f"UPDATE direct_deposit SET {set_clause} WHERE user_id = ?",
                    list(fields.values()) + [user_id],
                )
        else:
            cols = ["user_id"] + list(fields.keys())
            vals = [user_id] + list(fields.values())
            db.execute(
                f"INSERT INTO direct_deposit ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                vals,
            )
        db.commit()
        row = db.execute(
            "SELECT id, user_id, bank_name, account_type, updated_at FROM direct_deposit WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    return jsonify(dict(row))


# ── Work Schedule Template ────────────────────────────────────────────────────

@bp.route("/api/work-schedule", methods=["GET"])
def get_work_schedule():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute(
            "SELECT * FROM work_schedule_template WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row) if row else {})


@bp.route("/api/work-schedule", methods=["PUT"])
def upsert_work_schedule():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    allowed = {"schedule_type", "hours_per_week", "shift_start", "shift_end", "work_days"}
    fields = {k: v for k, v in data.items() if k in allowed}

    with get_db() as db:
        _ensure_tables(db)
        existing = db.execute(
            "SELECT id FROM work_schedule_template WHERE user_id = ?", (user_id,)
        ).fetchone()
        if existing:
            if fields:
                set_clause = ", ".join(f"{k} = ?" for k in fields)
                set_clause += ", updated_at = NOW()::text"
                db.execute(
                    f"UPDATE work_schedule_template SET {set_clause} WHERE user_id = ?",
                    list(fields.values()) + [user_id],
                )
        else:
            cols = ["user_id"] + list(fields.keys())
            vals = [user_id] + list(fields.values())
            db.execute(
                f"INSERT INTO work_schedule_template ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                vals,
            )
        db.commit()
        row = db.execute(
            "SELECT * FROM work_schedule_template WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row))
