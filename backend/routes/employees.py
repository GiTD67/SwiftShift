from datetime import datetime

from flask import Blueprint, jsonify, request

from db import get_db, safe_bootstrap
from permissions import current_uid, manager_required

bp = Blueprint("employees", __name__)


def _ensure_schema():
    # Idempotent DDL run on every worker boot (same pattern as payments.py):
    # every statement must be IF NOT EXISTS so a re-run can't abort the
    # Postgres transaction. CREATE TABLE mirrors auth.py so the ALTER below
    # is safe regardless of import order.
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS employees (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT
            )
            """
        )
        # NULL company_id = the legacy pre-company tenant.
        db.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id INTEGER")
        db.commit()


safe_bootstrap(_ensure_schema)


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


@bp.route("/api/employees", methods=["GET"])
def list_employees():
    with get_db() as db:
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            # Company accounts only ever see their own company's employees.
            rows = db.execute(
                "SELECT * FROM employees WHERE company_id IS NOT DISTINCT FROM ? ORDER BY id",
                (viewer_company,),
            ).fetchall()
        else:
            # Legacy pre-company viewers keep the original global behavior.
            rows = db.execute("SELECT * FROM employees ORDER BY id").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/employees", methods=["POST"])
def create_employee():
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    name = data.get("name")
    email = data.get("email")
    if not name:
        return jsonify({"error": "name required"}), 400
    with get_db() as db:
        # Stamp the new row with the creating manager's company so it never
        # leaks into other companies' lists (NULL = legacy pre-company tenant).
        company_id = _viewer_company_id(db, current_uid())
        cur = db.execute(
            "INSERT INTO employees (name, email, company_id) VALUES (?, ?, ?)",
            (name, email, company_id),
        )
        db.commit()
        emp = db.execute("SELECT * FROM employees WHERE id = ?", (cur.lastrowid,)).fetchone()
    if not emp:
        return jsonify({"error": "failed to create employee"}), 500
    return jsonify(dict(emp)), 201


@bp.route("/api/employees/enter_time", methods=["POST"])
def enter_time():
    data = request.get_json() or {}
    employee_id = current_uid()  # always clock in as yourself
    if not employee_id:
        return jsonify({"error": "authentication required"}), 401
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute(
            "INSERT INTO clock_sessions (employee_id, clock_in, notes) VALUES (?, ?, ?) RETURNING *",
            (employee_id, now, data.get("notes")),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


@bp.route("/api/employees/exit_time", methods=["POST"])
def exit_time():
    data = request.get_json() or {}
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id required"}), 400
    now = datetime.utcnow().isoformat()
    with get_db() as db:
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        if row["employee_id"] != current_uid():
            return jsonify({"error": "forbidden"}), 403
        if row["clock_out"]:
            return jsonify({"error": "already clocked out"}), 400
        try:
            clock_in = datetime.fromisoformat(row["clock_in"])
        except (TypeError, ValueError):
            return jsonify({"error": "session has an invalid clock-in time"}), 409
        duration = max(0, int((datetime.utcnow() - clock_in).total_seconds() / 60))
        db.execute(
            "UPDATE clock_sessions SET clock_out = ?, duration_minutes = ? WHERE id = ?",
            (now, duration, session_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
    return jsonify(dict(row))
