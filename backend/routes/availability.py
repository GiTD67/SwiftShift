from flask import Blueprint, jsonify, request

from db import get_db
from permissions import current_uid

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


# Direct deposit upgrade: support up to 3 accounts with percentage splits.
# Must use IF NOT EXISTS so existing single-account rows upgrade in place
# (slot 1 keeps the original columns and defaults to a 100% split).
_DEPOSIT_SPLIT_COLS = (
    "split_percent REAL DEFAULT 100",
    "bank_name_2 TEXT",
    "routing_number_2 TEXT",
    "account_number_2 TEXT",
    "account_type_2 TEXT",
    "split_percent_2 REAL",
    "bank_name_3 TEXT",
    "routing_number_3 TEXT",
    "account_number_3 TEXT",
    "account_type_3 TEXT",
    "split_percent_3 REAL",
)

# Column suffixes for deposit account slots 1-3 ("" = the original single-account columns).
_ACCOUNT_SUFFIXES = ("", "_2", "_3")


def _ensure_tables(db):
    for ddl in _DDL:
        db.execute(ddl)
    for col_def in _DEPOSIT_SPLIT_COLS:
        db.execute(f"ALTER TABLE direct_deposit ADD COLUMN IF NOT EXISTS {col_def}")


# ── Work Availability ─────────────────────────────────────────────────────────

@bp.route("/api/availability", methods=["GET"])
def get_availability():
    user_id = current_uid()
    if not user_id:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute(
            "SELECT * FROM work_availability WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row) if row else {})


@bp.route("/api/availability", methods=["PUT"])
def upsert_availability():
    data = request.get_json() or {}
    user_id = current_uid()
    if not user_id:
        return jsonify({"error": "authentication required"}), 401

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

def _deposit_payload(db, user_id):
    """Safe deposit summary (never echoes routing/account numbers) + accounts list."""
    safe_cols = ["id", "user_id", "updated_at"]
    for s in _ACCOUNT_SUFFIXES:
        safe_cols += [f"bank_name{s}", f"account_type{s}", f"split_percent{s}"]
    row = db.execute(
        f"SELECT {', '.join(safe_cols)} FROM direct_deposit WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if not row:
        return {}
    d = dict(row)
    d["accounts"] = [
        {"bank_name": d.get(f"bank_name{s}"), "account_type": d.get(f"account_type{s}"),
         "split_percent": d.get(f"split_percent{s}")}
        for s in _ACCOUNT_SUFFIXES
        if d.get(f"bank_name{s}") or d.get(f"split_percent{s}")
    ]
    return d


@bp.route("/api/direct-deposit", methods=["GET"])
def get_direct_deposit():
    user_id = current_uid()
    if not user_id:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        _ensure_tables(db)
        payload = _deposit_payload(db, user_id)
    return jsonify(payload)


@bp.route("/api/direct-deposit", methods=["PUT"])
def upsert_direct_deposit():
    data = request.get_json() or {}
    user_id = current_uid()
    if not user_id:
        return jsonify({"error": "authentication required"}), 401

    accounts = data.get("accounts")
    if accounts is not None:
        # New split-deposit shape: up to 3 accounts whose percentages total 100.
        if not isinstance(accounts, list) or not 1 <= len(accounts) <= 3 \
                or not all(isinstance(a, dict) for a in accounts):
            return jsonify({"error": "accounts must be a list of 1 to 3 accounts"}), 400
        try:
            splits = [float(a.get("split_percent") or 0) for a in accounts]
        except (TypeError, ValueError):
            return jsonify({"error": "split_percent must be a number"}), 400
        if any(s < 0 for s in splits):
            return jsonify({"error": "split_percent cannot be negative"}), 400
        if abs(sum(splits) - 100) > 0.01:
            return jsonify({"error": "split percentages must total 100"}), 400
        fields = {}
        for i, suffix in enumerate(_ACCOUNT_SUFFIXES):
            if i < len(accounts):
                acct = accounts[i]
                fields[f"bank_name{suffix}"] = acct.get("bank_name")
                fields[f"account_type{suffix}"] = acct.get("account_type") or "checking"
                fields[f"split_percent{suffix}"] = splits[i]
                # Numbers are never echoed back by GET, so only overwrite when re-entered.
                if acct.get("routing_number"):
                    fields[f"routing_number{suffix}"] = acct.get("routing_number")
                if acct.get("account_number"):
                    fields[f"account_number{suffix}"] = acct.get("account_number")
            else:
                for col in ("bank_name", "routing_number", "account_number", "account_type", "split_percent"):
                    fields[f"{col}{suffix}"] = None
    else:
        # Legacy single-account shape, kept working for existing callers/data.
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
        payload = _deposit_payload(db, user_id)
    return jsonify(payload)


# ── Work Schedule Template ────────────────────────────────────────────────────

@bp.route("/api/work-schedule", methods=["GET"])
def get_work_schedule():
    user_id = current_uid()
    if not user_id:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute(
            "SELECT * FROM work_schedule_template WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify(dict(row) if row else {})


@bp.route("/api/work-schedule", methods=["PUT"])
def upsert_work_schedule():
    data = request.get_json() or {}
    user_id = current_uid()
    if not user_id:
        return jsonify({"error": "authentication required"}), 401

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
