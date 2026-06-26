from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from audit import log_event
from db import get_db
from notifications import notify_pto_decision
from permissions import current_uid, is_manager, manager_required

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


# Partial-day support: a request can cover just part of one day (e.g. 3 hours).
_PARTIAL_DAY_COLS = [
    "is_partial_day INTEGER NOT NULL DEFAULT 0",
    "start_time TEXT",
    "end_time TEXT",
]


def _ensure_tables(db):
    for ddl in _DDL:
        db.execute(ddl)
    for col_def in _PARTIAL_DAY_COLS:
        db.execute(f"ALTER TABLE pto_requests ADD COLUMN IF NOT EXISTS {col_def}")


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


# GET /api/pto/balance?user_id=X
@bp.route("/api/pto/balance", methods=["GET"])
def get_balance():
    user_id = current_uid()
    if not user_id:
        return jsonify({"error": "authentication required"}), 401
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


# POST /api/pto/balance/accrue  - called on every clock-out
@bp.route("/api/pto/balance/accrue", methods=["POST"])
def accrue_pto():
    data = request.get_json() or {}
    user_id = current_uid()
    hours_worked = data.get("hours_worked")
    if not user_id or hours_worked is None:
        return jsonify({"error": "hours_worked required"}), 400
    try:
        hours_worked = float(hours_worked)
    except (TypeError, ValueError):
        return jsonify({"error": "hours_worked must be a number"}), 400
    if hours_worked < 0:
        return jsonify({"error": "hours_worked cannot be negative"}), 400
    # Cap at one day so a forgotten clock-out can't accrue a runaway balance.
    hours_worked = min(hours_worked, 24)

    accrual_rate = 0.0385  # ~1 hr per 26 hrs worked (~10 days/year)
    hours_accrued = round(hours_worked * accrual_rate, 4)

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
    uid = current_uid()
    with get_db() as db:
        _ensure_tables(db)
        if is_manager(uid):
            viewer_company = _viewer_company_id(db, uid)
            if viewer_company is not None:
                # Company managers only see their own company's requests.
                rows = db.execute(
                    """
                    SELECT * FROM pto_requests
                    WHERE user_id IN (SELECT id FROM users WHERE company_id = ?)
                    ORDER BY created_at DESC
                    """,
                    (viewer_company,),
                ).fetchall()
            else:
                # Legacy pre-company managers keep the original global behavior.
                rows = db.execute(
                    "SELECT * FROM pto_requests ORDER BY created_at DESC"
                ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM pto_requests WHERE user_id = ? ORDER BY created_at DESC",
                (uid,),
            ).fetchall()
    return jsonify([dict(r) for r in rows])


# POST /api/pto/requests
@bp.route("/api/pto/requests", methods=["POST"])
def create_request():
    data = request.get_json() or {}
    user_id = current_uid()
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    hours_requested = data.get("hours_requested")
    if not all([user_id, start_date, end_date, hours_requested is not None]):
        return jsonify({"error": "start_date, end_date, hours_requested required"}), 400
    try:
        hours_requested = float(hours_requested)
    except (TypeError, ValueError):
        return jsonify({"error": "hours_requested must be a number"}), 400
    if hours_requested <= 0:
        return jsonify({"error": "hours_requested must be greater than 0"}), 400
    try:
        if datetime.fromisoformat(start_date) > datetime.fromisoformat(end_date):
            return jsonify({"error": "start_date must be on or before end_date"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "start_date and end_date must be valid dates (YYYY-MM-DD)"}), 400

    with get_db() as db:
        _ensure_tables(db)
        # Check balance
        balance_row = db.execute(
            "SELECT hours_available FROM pto_balances WHERE user_id = ?", (user_id,)
        ).fetchone()
        available = float(balance_row["hours_available"]) if balance_row else 0
        if available < hours_requested:
            return jsonify({"error": "insufficient PTO balance", "available": available}), 400

        row = db.execute(
            """
            INSERT INTO pto_requests (user_id, request_type, start_date, end_date, hours_requested, reason, is_partial_day, start_time, end_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
            """,
            (
                user_id,
                data.get("request_type", "vacation"),
                start_date,
                end_date,
                hours_requested,
                data.get("reason"),
                1 if data.get("is_partial_day") else 0,
                data.get("start_time") or None,
                data.get("end_time") or None,
            ),
        ).fetchone()
        db.commit()
    log_event(user_id, None, "pto_request", f"Requested {hours_requested}h PTO ({start_date} to {end_date})")
    return jsonify(dict(row)), 201


# PUT /api/pto/requests/:id  - manager approve/deny, or owner edit while pending
@bp.route("/api/pto/requests/<int:req_id>", methods=["PUT"])
def update_request(req_id):
    data = request.get_json() or {}
    if "status" not in data:
        # No status change: the request owner is editing a pending request.
        return _owner_edit(req_id, data)
    err = manager_required()
    if err:
        return err
    status = data.get("status")
    if status not in ("approved", "denied", "pending"):
        return jsonify({"error": "status must be approved, denied, or pending"}), 400

    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404

        # Company managers may only review their own company's requests.
        # Legacy (NULL-company) managers keep the original global behavior.
        caller_company = _viewer_company_id(db, current_uid())
        if caller_company is not None:
            owner = db.execute(
                "SELECT company_id FROM users WHERE id = ?", (row["user_id"],)
            ).fetchone()
            owner_company = owner["company_id"] if owner else None
            if owner_company != caller_company:
                return jsonify({"error": "not found"}), 404

        # Cancelled is terminal: the employee withdrew the request, so it can't
        # be approved, denied, or reopened afterwards.
        if row["status"] == "cancelled":
            return jsonify({"error": "cancelled requests cannot be reviewed"}), 400

        # Deduct hours from balance when approving. The balance check lives in
        # the UPDATE's WHERE clause (not a separate read) so two concurrent
        # approvals can't both pass the check and drive the balance negative.
        # This runs before the status write: if it fails, nothing has changed.
        if status == "approved" and row["status"] != "approved":
            deducted = db.execute(
                """
                UPDATE pto_balances
                SET hours_available = hours_available - ?,
                    hours_used = hours_used + ?,
                    updated_at = NOW()::text
                WHERE user_id = ? AND hours_available >= ?
                RETURNING hours_available
                """,
                (row["hours_requested"], row["hours_requested"], row["user_id"],
                 row["hours_requested"]),
            ).fetchone()
            if deducted is None:
                balance_row = db.execute(
                    "SELECT hours_available FROM pto_balances WHERE user_id = ?",
                    (row["user_id"],),
                ).fetchone()
                available = float(balance_row["hours_available"]) if balance_row else 0
                return jsonify({"error": "insufficient PTO balance", "available": available}), 400

        db.execute(
            "UPDATE pto_requests SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
            (status, current_uid(), now, req_id),
        )
        # Refund if un-approving a previously approved request
        if status != "approved" and row["status"] == "approved":
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
    if status in ("approved", "denied"):
        log_event(
            current_uid(), None,
            "pto_approve" if status == "approved" else "pto_deny",
            f"PTO request #{req_id} ({row['hours_requested']}h, user #{row['user_id']}) {status}",
        )
        notify_pto_decision(
            row["user_id"], status, row["hours_requested"],
            row["start_date"], row["end_date"],
        )
    return jsonify(dict(row))


def _owner_edit(req_id, data):
    uid = current_uid()
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        if row["user_id"] != uid:
            return jsonify({"error": "only the request owner can edit it"}), 403
        if row["status"] != "pending":
            return jsonify({"error": "only pending requests can be edited"}), 400

        start_date = data.get("start_date", row["start_date"])
        end_date = data.get("end_date", row["end_date"])
        try:
            hours_requested = float(data.get("hours_requested", row["hours_requested"]))
        except (TypeError, ValueError):
            return jsonify({"error": "hours_requested must be a number"}), 400
        if hours_requested <= 0:
            return jsonify({"error": "hours_requested must be positive"}), 400
        try:
            if datetime.fromisoformat(str(start_date)) > datetime.fromisoformat(str(end_date)):
                return jsonify({"error": "start_date must be on or before end_date"}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "start_date and end_date must be valid dates (YYYY-MM-DD)"}), 400

        # Check balance against the edited amount
        balance_row = db.execute(
            "SELECT hours_available FROM pto_balances WHERE user_id = ?", (uid,)
        ).fetchone()
        available = float(balance_row["hours_available"]) if balance_row else 0
        if available < hours_requested:
            return jsonify({"error": "insufficient PTO balance", "available": available}), 400

        db.execute(
            """
            UPDATE pto_requests
            SET request_type = ?, start_date = ?, end_date = ?, hours_requested = ?,
                reason = ?, is_partial_day = ?, start_time = ?, end_time = ?
            WHERE id = ?
            """,
            (
                data.get("request_type", row["request_type"]),
                start_date,
                end_date,
                hours_requested,
                data.get("reason", row["reason"]),
                1 if data.get("is_partial_day", row["is_partial_day"]) else 0,
                data.get("start_time", row["start_time"]) or None,
                data.get("end_time", row["end_time"]) or None,
                req_id,
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
    log_event(uid, None, "pto_edit", f"Edited PTO request #{req_id} ({hours_requested}h, {start_date} to {end_date})")
    return jsonify(dict(row))


# DELETE /api/pto/requests/:id  - owner cancels a still-pending request
@bp.route("/api/pto/requests/<int:req_id>", methods=["DELETE"])
def cancel_request(req_id):
    uid = current_uid()
    with get_db() as db:
        _ensure_tables(db)
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        if row["user_id"] != uid:
            return jsonify({"error": "only the request owner can cancel it"}), 403
        if row["status"] != "pending":
            return jsonify({"error": "only pending requests can be cancelled"}), 400
        db.execute("UPDATE pto_requests SET status = 'cancelled' WHERE id = ?", (req_id,))
        db.commit()
        row = db.execute("SELECT * FROM pto_requests WHERE id = ?", (req_id,)).fetchone()
    log_event(uid, None, "pto_cancel", f"Cancelled PTO request #{req_id} ({row['hours_requested']}h)")
    return jsonify(dict(row))
