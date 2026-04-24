from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("pto", __name__)

_DDL = [
    """
    CREATE TABLE IF NOT EXISTS pto_balances (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      hours_available REAL NOT NULL DEFAULT 0,
      hours_used REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS pto_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      request_type TEXT NOT NULL DEFAULT 'vacation',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      hours_requested REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
    """,
]


def _ensure_tables(db):
    for ddl in _DDL:
        db.execute(ddl)


# GET /api/pto/balance?user_id=X
@bp.route("/api/pto/balance", methods=["GET"])
def get_balance():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute(
            "SELECT * FROM pto_balances WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not row:
            row = db.execute(
                "INSERT INTO pto_balances (user_id, hours_available, hours_used) VALUES (?, 0, 0) RETURNING *",
                (user_id,),
            ).fetchone()
            db.commit()
    return jsonify(dict(row))


# POST /api/pto/balance/accrue  — called on every clock-out
@bp.route("/api/pto/balance/accrue", methods=["POST"])
def accrue_pto():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    hours_worked = data.get("hours_worked")
    if not user_id or hours_worked is None:
        return jsonify({"error": "user_id and hours_worked required"}), 400

    accrual_rate = 0.0385  # ~1 hr per 26 hrs worked (~10 days/year)
    hours_accrued = round(float(hours_worked) * accrual_rate, 4)

    with get_db() as db:
        _ensure_tables(db)
        db.execute(
            """
            INSERT INTO pto_balances (user_id, hours_available, hours_used)
            VALUES (?, ?, 0)
            ON CONFLICT (user_id) DO UPDATE
              SET hours_available = pto_balances.hours_available + EXCLUDED.hours_available,
                  updated_at = NOW()::text
            """,
            (user_id, hours_accrued),
        )
        db.commit()
        row = db.execute(
            "SELECT * FROM pto_balances WHERE user_id = ?", (user_id,)
        ).fetchone()
    return jsonify({"accrued": hours_accrued, "balance": dict(row)})


# GET /api/pto/requests?user_id=X
@bp.route("/api/pto/requests", methods=["GET"])
def list_requests():
    user_id = request.args.get("user_id")
    with get_db() as db:
        _ensure_tables(db)
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


# POST /api/pto/requests
@bp.route("/api/pto/requests", methods=["POST"])
def create_request():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    hours_requested = data.get("hours_requested")
    if not all([user_id, start_date, end_date, hours_requested is not None]):
        return jsonify({"error": "user_id, start_date, end_date, hours_requested required"}), 400

    with get_db() as db:
        _ensure_tables(db)
        # Check balance
        balance_row = db.execute(
            "SELECT hours_available FROM pto_balances WHERE user_id = ?", (user_id,)
        ).fetchone()
        available = float(balance_row["hours_available"]) if balance_row else 0
        if available < float(hours_requested):
            return jsonify({"error": "insufficient PTO balance", "available": available}), 400

        row = db.execute(
            """
            INSERT INTO pto_requests (user_id, request_type, start_date, end_date, hours_requested, reason)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            (
                user_id,
                data.get("request_type", "vacation"),
                start_date,
                end_date,
                hours_requested,
                data.get("reason"),
            ),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


# PUT /api/pto/requests/:id  — approve or deny
@bp.route("/api/pto/requests/<int:req_id>", methods=["PUT"])
def update_request(req_id):
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("approved", "denied", "pending"):
        return jsonify({"error": "status must be approved, denied, or pending"}), 400

    now = datetime.utcnow().isoformat()
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404

        db.execute(
            "UPDATE pto_requests SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (status, data.get("reviewed_by"), now, req_id),
        )

        # Deduct hours from balance when approved
        if status == "approved" and row["status"] != "approved":
            db.execute(
                """
                UPDATE pto_balances
                SET hours_available = hours_available - ?,
                    hours_used = hours_used + ?,
                    updated_at = NOW()::text
                WHERE user_id = ?
                """,
                (row["hours_requested"], row["hours_requested"], row["user_id"]),
            )
        # Refund if un-approving a previously approved request
        elif status != "approved" and row["status"] == "approved":
            db.execute(
                """
                UPDATE pto_balances
                SET hours_available = hours_available + ?,
                    hours_used = hours_used - ?,
                    updated_at = NOW()::text
                WHERE user_id = ?
                """,
                (row["hours_requested"], row["hours_requested"], row["user_id"]),
            )

        db.commit()
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
    return jsonify(dict(row))
