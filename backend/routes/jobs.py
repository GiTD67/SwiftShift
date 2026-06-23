from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db, safe_bootstrap
from permissions import current_uid, manager_required

bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")


def _ensure_columns():
    # Idempotent DDL run on every worker boot. company_id NULL marks rows
    # belonging to the legacy pre-company pool. CREATE TABLE mirrors
    # auth.py's _ensure_jobs_table so the ALTER below is safe regardless of
    # import order (this module loads before auth on a fresh database).
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
              job_id SERIAL PRIMARY KEY,
              description TEXT,
              hiring_manager_id INTEGER,
              date_posted TEXT,
              date_expiry TEXT,
              salary TEXT,
              location TEXT
            )
            """
        )
        db.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id INTEGER")


safe_bootstrap(_ensure_columns)


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


@bp.route("", methods=["GET"])
def list_jobs():
    with get_db() as db:
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            # Company accounts only ever see their own company's postings.
            rows = db.execute(
                "SELECT * FROM jobs WHERE company_id IS NOT DISTINCT FROM ? ORDER BY date_posted DESC",
                (viewer_company,),
            ).fetchall()
        else:
            # Legacy pre-company viewers keep the original global behavior.
            rows = db.execute("SELECT * FROM jobs ORDER BY date_posted DESC").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("", methods=["POST"])
def create_job():
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    description = data.get("description")
    if not description:
        return jsonify({"error": "description required"}), 400
    hiring_manager_id = data.get("hiring_manager_id")
    salary = data.get("salary")
    location = data.get("location")
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            if hiring_manager_id is None:
                # Company postings always carry an in-company hiring manager.
                hiring_manager_id = current_uid()
            else:
                try:
                    hiring_manager_id = int(hiring_manager_id)
                except (TypeError, ValueError):
                    return jsonify({"error": "invalid hiring_manager_id"}), 400
                target = db.execute(
                    "SELECT company_id FROM users WHERE id = ?",
                    (hiring_manager_id,),
                ).fetchone()
                if not target:
                    return jsonify({"error": "hiring manager not found"}), 404
                if target["company_id"] != viewer_company:
                    return jsonify({"error": "hiring manager not in your company"}), 400
        row = db.execute(
            """INSERT INTO jobs (description, hiring_manager_id, date_posted, date_expiry, salary, location, company_id)
               VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *""",
            (description, hiring_manager_id, now, data.get("date_expiry"), salary, location, viewer_company),
        ).fetchone()
    if not row:
        return jsonify({"error": "failed to create job"}), 500
    return jsonify(dict(row)), 201
