from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("shift_swaps", __name__)


def _ensure_tables():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS shift_swaps (
                id SERIAL PRIMARY KEY,
                requester_id INTEGER NOT NULL,
                target_user_id INTEGER,
                shift_date TEXT,
                shift_label TEXT,
                reason TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT,
                updated_at TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS timesheet_submissions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                period_start TEXT,
                period_end TEXT,
                total_hours REAL,
                status TEXT DEFAULT 'submitted',
                submitted_at TEXT,
                approved_at TEXT
            )
        """)
        db.commit()


try:
    _ensure_tables()
except Exception:
    pass


@bp.route("/api/shift-swaps", methods=["GET"])
def list_swaps():
    user_id = request.args.get("user_id")
    with get_db() as db:
        if user_id:
            rows = db.execute(
                "SELECT * FROM shift_swaps WHERE requester_id = ? OR target_user_id = ? ORDER BY created_at DESC",
                (user_id, user_id),
            ).fetchall()
        else:
            rows = db.execute("SELECT * FROM shift_swaps ORDER BY created_at DESC").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/shift-swaps", methods=["POST"])
def create_swap():
    data = request.get_json() or {}
    requester_id = data.get("requester_id")
    if not requester_id:
        return jsonify({"error": "requester_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute(
            """INSERT INTO shift_swaps
               (requester_id, target_user_id, shift_date, shift_label, reason, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'pending', ?, ?) RETURNING *""",
            (
                requester_id,
                data.get("target_user_id"),
                data.get("shift_date"),
                data.get("shift_label"),
                data.get("reason"),
                now,
                now,
            ),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


@bp.route("/api/shift-swaps/<int:swap_id>", methods=["PUT"])
def update_swap(swap_id):
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("approved", "denied", "pending", "cancelled"):
        return jsonify({"error": "invalid status"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute("SELECT * FROM shift_swaps WHERE id = ?", (swap_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        db.execute(
            "UPDATE shift_swaps SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, swap_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM shift_swaps WHERE id = ?", (swap_id,)).fetchone()
    return jsonify(dict(row))


@bp.route("/api/timesheet-submissions", methods=["GET"])
def list_submissions():
    user_id = request.args.get("user_id")
    with get_db() as db:
        if user_id:
            rows = db.execute(
                "SELECT * FROM timesheet_submissions WHERE user_id = ? ORDER BY submitted_at DESC",
                (user_id,),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM timesheet_submissions ORDER BY submitted_at DESC"
            ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/timesheet-submissions", methods=["POST"])
def create_submission():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute(
            """INSERT INTO timesheet_submissions
               (user_id, period_start, period_end, total_hours, status, submitted_at)
               VALUES (?, ?, ?, ?, 'submitted', ?) RETURNING *""",
            (
                user_id,
                data.get("period_start"),
                data.get("period_end"),
                float(data.get("total_hours", 0)),
                now,
            ),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


@bp.route("/api/timesheet-submissions/<int:sub_id>", methods=["PUT"])
def update_submission(sub_id):
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("approved", "rejected", "submitted"):
        return jsonify({"error": "invalid status"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM timesheet_submissions WHERE id = ?", (sub_id,)
        ).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        approved_at = now if status == "approved" else None
        db.execute(
            "UPDATE timesheet_submissions SET status = ?, approved_at = ? WHERE id = ?",
            (status, approved_at, sub_id),
        )
        db.commit()
        row = db.execute(
            "SELECT * FROM timesheet_submissions WHERE id = ?", (sub_id,)
        ).fetchone()
    return jsonify(dict(row))
