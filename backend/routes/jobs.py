from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db

bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")


@bp.route("", methods=["GET"])
def list_jobs():
    with get_db() as db:
        rows = db.execute("SELECT * FROM jobs ORDER BY date_posted DESC").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("", methods=["POST"])
def create_job():
    data = request.get_json() or {}
    description = data.get("description")
    hiring_manager_id = data.get("hiring_manager_id")
    salary = data.get("salary")
    location = data.get("location")
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        cur = db.execute(
            """INSERT INTO jobs (description, hiring_manager_id, date_posted, date_expiry, salary, location)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (description, hiring_manager_id, now, data.get("date_expiry"), salary, location),
        )
        db.commit()
        row = db.execute("SELECT * FROM jobs WHERE job_id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201
