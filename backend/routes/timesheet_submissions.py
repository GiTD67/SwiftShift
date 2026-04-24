from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("timesheet_submissions", __name__)

_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS timesheet_submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_hours REAL NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (NOW()::text),
  UNIQUE (user_id, period_start)
)
"""


def _ensure_table(db):
    db.execute(_TABLE_DDL)


@bp.route("/api/timesheet-submissions", methods=["GET"])
def list_submissions():
    user_id = request.args.get("user_id")
    with get_db() as db:
        _ensure_table(db)
        if user_id:
            rows = db.execute(
                "SELECT * FROM timesheet_submissions WHERE user_id = ? ORDER BY period_start DESC",
                (user_id,),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM timesheet_submissions ORDER BY period_start DESC"
            ).fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/timesheet-submissions", methods=["POST"])
def create_submission():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    period_start = data.get("period_start")
    period_end = data.get("period_end")
    total_hours = data.get("total_hours")

    if not all([user_id, period_start, period_end, total_hours is not None]):
        return jsonify({"error": "user_id, period_start, period_end, and total_hours are required"}), 400

    with get_db() as db:
        _ensure_table(db)
        row = db.execute(
            """
            INSERT INTO timesheet_submissions (user_id, period_start, period_end, total_hours)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id, period_start) DO UPDATE
              SET period_end = EXCLUDED.period_end,
                  total_hours = EXCLUDED.total_hours,
                  submitted_at = NOW()::text
            RETURNING *
            """,
            (user_id, period_start, period_end, total_hours),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201
