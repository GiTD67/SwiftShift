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
    if not description:
        return jsonify({"error": "description required"}), 400
    hiring_manager_id = data.get("hiring_manager_id")
    salary = data.get("salary")
    location = data.get("location")
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute(
            """INSERT INTO jobs (description, hiring_manager_id, date_posted, date_expiry, salary, location)
               VALUES (?, ?, ?, ?, ?, ?) RETURNING *""",
            (description, hiring_manager_id, now, data.get("date_expiry"), salary, location),
        ).fetchone()
    if not row:
        return jsonify({"error": "failed to create job"}), 500
    return jsonify(dict(row)), 201
