from flask import Blueprint, jsonify, request

from db import get_db
from permissions import manager_required

bp = Blueprint("holidays", __name__)

_DDL = [
    """
    CREATE TABLE IF NOT EXISTS company_holidays (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      recurring INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
    """,
]


def _ensure_tables(db):
    for ddl in _DDL:
        db.execute(ddl)


# GET /api/holidays
@bp.route("/api/holidays", methods=["GET"])
def list_holidays():
    with get_db() as db:
        _ensure_tables(db)
        rows = db.execute(
            "SELECT * FROM company_holidays ORDER BY date ASC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


# POST /api/holidays
@bp.route("/api/holidays", methods=["POST"])
def create_holiday():
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    date = data.get("date", "").strip()
    if not name or not date:
        return jsonify({"error": "name and date are required"}), 400

    with get_db() as db:
        _ensure_tables(db)
        row = db.execute(
            """
            INSERT INTO company_holidays (name, date, recurring, description)
            VALUES (?, ?, ?, ?)
            RETURNING *
            """,
            (name, date, 1 if data.get("recurring") else 0, data.get("description", "")),
        ).fetchone()
        db.commit()
    return jsonify(dict(row)), 201


# PUT /api/holidays/:id
@bp.route("/api/holidays/<int:holiday_id>", methods=["PUT"])
def update_holiday(holiday_id):
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    date = data.get("date", "").strip()
    if not name or not date:
        return jsonify({"error": "name and date are required"}), 400

    with get_db() as db:
        _ensure_tables(db)
        existing = db.execute(
            "SELECT id FROM company_holidays WHERE id = ?", (holiday_id,)
        ).fetchone()
        if not existing:
            return jsonify({"error": "not found"}), 404
        db.execute(
            "UPDATE company_holidays SET name = ?, date = ?, recurring = ?, description = ? WHERE id = ?",
            (name, date, 1 if data.get("recurring") else 0, data.get("description", ""), holiday_id),
        )
        db.commit()
        row = db.execute(
            "SELECT * FROM company_holidays WHERE id = ?", (holiday_id,)
        ).fetchone()
    return jsonify(dict(row))


# DELETE /api/holidays/:id
@bp.route("/api/holidays/<int:holiday_id>", methods=["DELETE"])
def delete_holiday(holiday_id):
    err = manager_required()
    if err:
        return err
    with get_db() as db:
        _ensure_tables(db)
        existing = db.execute(
            "SELECT id FROM company_holidays WHERE id = ?", (holiday_id,)
        ).fetchone()
        if not existing:
            return jsonify({"error": "not found"}), 404
        db.execute("DELETE FROM company_holidays WHERE id = ?", (holiday_id,))
        db.commit()
    return jsonify({"deleted": holiday_id})
