from datetime import date

from flask import Blueprint, jsonify, request

from audit import log_event
from db import get_db
from permissions import current_uid, manager_required

bp = Blueprint("open_shifts", __name__)

_DDL = """
CREATE TABLE IF NOT EXISTS open_shifts (
  id SERIAL PRIMARY KEY,
  shift_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  job_or_role TEXT,
  posted_by INTEGER NOT NULL,
  claimed_by INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (NOW()::text)
)
"""


def _ensure_table(db):
    db.execute(_DDL)


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


# GET /api/open-shifts - upcoming open/claimed shifts (everyone), with claim state
@bp.route("/api/open-shifts", methods=["GET"])
def list_open_shifts():
    today = date.today().isoformat()
    with get_db() as db:
        _ensure_table(db)
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            # Company accounts only see shifts posted by their own company.
            rows = db.execute(
                """
                SELECT os.*, u.first_name || ' ' || u.last_name AS claimed_by_name
                FROM open_shifts os
                LEFT JOIN users u ON u.id = os.claimed_by
                JOIN users p ON p.id = os.posted_by
                WHERE os.shift_date >= ? AND os.status != 'cancelled' AND p.company_id = ?
                ORDER BY os.shift_date ASC, os.start_time ASC
                """,
                (today, viewer_company),
            ).fetchall()
        else:
            # Legacy pre-company viewers keep the original global behavior.
            rows = db.execute(
                """
                SELECT os.*, u.first_name || ' ' || u.last_name AS claimed_by_name
                FROM open_shifts os
                LEFT JOIN users u ON u.id = os.claimed_by
                WHERE os.shift_date >= ? AND os.status != 'cancelled'
                ORDER BY os.shift_date ASC, os.start_time ASC
                """,
                (today,),
            ).fetchall()
    return jsonify([dict(r) for r in rows])


# POST /api/open-shifts - manager posts an open shift
@bp.route("/api/open-shifts", methods=["POST"])
def create_open_shift():
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    shift_date = (data.get("shift_date") or "").strip()
    start_time = (data.get("start_time") or "").strip()
    end_time = (data.get("end_time") or "").strip()
    if not all([shift_date, start_time, end_time]):
        return jsonify({"error": "shift_date, start_time, end_time required"}), 400

    with get_db() as db:
        _ensure_table(db)
        row = db.execute(
            """
            INSERT INTO open_shifts (shift_date, start_time, end_time, job_or_role, posted_by)
            VALUES (?, ?, ?, ?, ?)
            RETURNING *
            """,
            (shift_date, start_time, end_time, data.get("job_or_role"), current_uid()),
        ).fetchone()
        db.commit()
    log_event(current_uid(), None, "open_shift_post", f"Posted open shift for {shift_date} ({start_time}-{end_time})")
    return jsonify(dict(row)), 201


# POST /api/open-shifts/:id/claim - first successful claim wins
@bp.route("/api/open-shifts/<int:shift_id>/claim", methods=["POST"])
def claim_open_shift(shift_id):
    uid = current_uid()
    with get_db() as db:
        _ensure_table(db)
        claimer_company = _viewer_company_id(db, uid)
        # The status = 'open' condition makes the claim atomic: a second claimer
        # matches zero rows, so double-claiming is rejected.
        if claimer_company is not None:
            # Company accounts can only claim shifts posted by their own company.
            row = db.execute(
                """
                UPDATE open_shifts SET claimed_by = ?, status = 'claimed'
                WHERE id = ? AND status = 'open'
                  AND posted_by IN (SELECT id FROM users WHERE company_id = ?)
                RETURNING *
                """,
                (uid, shift_id, claimer_company),
            ).fetchone()
        else:
            row = db.execute(
                """
                UPDATE open_shifts SET claimed_by = ?, status = 'claimed'
                WHERE id = ? AND status = 'open'
                RETURNING *
                """,
                (uid, shift_id),
            ).fetchone()
        db.commit()
        if not row:
            if claimer_company is not None:
                existing = db.execute(
                    """
                    SELECT id FROM open_shifts
                    WHERE id = ? AND posted_by IN (SELECT id FROM users WHERE company_id = ?)
                    """,
                    (shift_id, claimer_company),
                ).fetchone()
            else:
                existing = db.execute("SELECT id FROM open_shifts WHERE id = ?", (shift_id,)).fetchone()
            if not existing:
                return jsonify({"error": "not found"}), 404
            return jsonify({"error": "shift already claimed"}), 409
    log_event(uid, None, "open_shift_claim", f"Claimed open shift #{shift_id} ({row['shift_date']} {row['start_time']}-{row['end_time']})")
    return jsonify(dict(row))


# DELETE /api/open-shifts/:id - manager cancels a posted shift
@bp.route("/api/open-shifts/<int:shift_id>", methods=["DELETE"])
def cancel_open_shift(shift_id):
    err = manager_required()
    if err:
        return err
    with get_db() as db:
        _ensure_table(db)
        caller_company = _viewer_company_id(db, current_uid())
        if caller_company is not None:
            # Company managers can only cancel shifts posted by their own company.
            existing = db.execute(
                """
                SELECT id FROM open_shifts
                WHERE id = ? AND posted_by IN (SELECT id FROM users WHERE company_id = ?)
                """,
                (shift_id, caller_company),
            ).fetchone()
            if not existing:
                return jsonify({"error": "not found"}), 404
            db.execute(
                """
                UPDATE open_shifts SET status = 'cancelled'
                WHERE id = ? AND posted_by IN (SELECT id FROM users WHERE company_id = ?)
                """,
                (shift_id, caller_company),
            )
        else:
            existing = db.execute("SELECT id FROM open_shifts WHERE id = ?", (shift_id,)).fetchone()
            if not existing:
                return jsonify({"error": "not found"}), 404
            db.execute("UPDATE open_shifts SET status = 'cancelled' WHERE id = ?", (shift_id,))
        db.commit()
    log_event(current_uid(), None, "open_shift_cancel", f"Cancelled open shift #{shift_id}")
    return jsonify({"cancelled": shift_id})
