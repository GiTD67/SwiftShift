"""One-click data export: the logged-in user's data as JSON/CSV, plus a manager-only company zip."""
import csv
import io
import json
import zipfile
from datetime import datetime

from flask import Blueprint, Response, jsonify

from audit import _ensure_table as _ensure_audit_table
from db import get_db
from permissions import current_uid, manager_required
from routes.pto import _ensure_tables as _ensure_pto_tables
from routes.shift_swaps import _ensure_table as _ensure_swaps_table
from routes.timesheet_submissions import _ensure_table as _ensure_timesheets_table

bp = Blueprint("export", __name__)


def _ensure_tables(db):
    """Lazily-created tables (PTO, swaps, timesheets, audit) may not exist yet."""
    _ensure_pto_tables(db)
    _ensure_swaps_table(db)
    _ensure_timesheets_table(db)
    _ensure_audit_table(db)


def _rows(db, sql, params=()):
    return [dict(r) for r in db.execute(sql, params).fetchall()]


def _strip_password(user_row):
    return {k: v for k, v in dict(user_row).items() if k != "password_hash"}


def _table_csv(rows):
    """Render a list of row dicts as a CSV string (column order from the query)."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    if rows:
        headers = list(rows[0].keys())
        writer.writerow(headers)
        for r in rows:
            writer.writerow(["" if r.get(h) is None else r.get(h) for h in headers])
    return buf.getvalue()


def _attachment(body, filename, mimetype):
    return Response(
        body,
        mimetype=mimetype,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# GET /api/export/me — everything the logged-in user owns, as one JSON bundle
@bp.route("/api/export/me", methods=["GET"])
def export_me():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        _ensure_tables(db)
        profile = db.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
        balance = db.execute("SELECT * FROM pto_balances WHERE user_id = ?", (uid,)).fetchone()
        bundle = {
            "exported_at": datetime.utcnow().isoformat(),
            "profile": _strip_password(profile) if profile else None,
            "clock_sessions": _rows(db, "SELECT * FROM clock_sessions WHERE employee_id = ? ORDER BY clock_in DESC", (uid,)),
            "time_entries": _rows(db, "SELECT * FROM time_entries WHERE employee_id = ? ORDER BY date DESC, start_time DESC", (uid,)),
            "pto_balance": dict(balance) if balance else None,
            "pto_requests": _rows(db, "SELECT * FROM pto_requests WHERE user_id = ? ORDER BY created_at DESC", (uid,)),
            "shift_swaps": _rows(db, "SELECT * FROM shift_swaps WHERE requester_id = ? OR target_id = ? ORDER BY shift_date DESC", (uid, uid)),
            "timesheet_submissions": _rows(db, "SELECT * FROM timesheet_submissions WHERE user_id = ? ORDER BY period_start DESC", (uid,)),
        }
    filename = f"swiftshift-my-data-{datetime.utcnow().date().isoformat()}.json"
    return _attachment(json.dumps(bundle, indent=2, default=str), filename, "application/json")


# GET /api/export/me.csv — the logged-in user's time data (clock sessions + manual entries)
@bp.route("/api/export/me.csv", methods=["GET"])
def export_me_csv():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        sessions = _rows(db, "SELECT * FROM clock_sessions WHERE employee_id = ? ORDER BY clock_in DESC", (uid,))
        entries = _rows(db, "SELECT * FROM time_entries WHERE employee_id = ? ORDER BY date DESC, start_time DESC", (uid,))
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["source", "id", "date", "start", "end", "duration_minutes", "break_minutes", "project", "task", "notes"])
    for s in sessions:
        writer.writerow([
            "clock_session", s["id"], (s["clock_in"] or "")[:10], s["clock_in"] or "", s["clock_out"] or "",
            s["duration_minutes"] if s["duration_minutes"] is not None else "", s["break_minutes"] or 0, "", "", s["notes"] or "",
        ])
    for e in entries:
        writer.writerow([
            "time_entry", e["id"], e["date"] or "", e["start_time"] or "", e["end_time"] or "",
            e["duration_minutes"] if e["duration_minutes"] is not None else "", "", e["project"] or "", e["task"] or "", e["description"] or "",
        ])
    filename = f"swiftshift-my-time-{datetime.utcnow().date().isoformat()}.csv"
    return _attachment(buf.getvalue(), filename, "text/csv")


# GET /api/export/company — manager-only zip of per-table CSVs for all users
@bp.route("/api/export/company", methods=["GET"])
def export_company():
    err = manager_required()
    if err:
        return err
    with get_db() as db:
        _ensure_tables(db)
        tables = {
            "users": [_strip_password(r) for r in db.execute("SELECT * FROM users ORDER BY id").fetchall()],
            "clock_sessions": _rows(db, "SELECT * FROM clock_sessions ORDER BY id"),
            "time_entries": _rows(db, "SELECT * FROM time_entries ORDER BY id"),
            "pto_balances": _rows(db, "SELECT * FROM pto_balances ORDER BY user_id"),
            "pto_requests": _rows(db, "SELECT * FROM pto_requests ORDER BY id"),
            "shift_swaps": _rows(db, "SELECT * FROM shift_swaps ORDER BY id"),
            "timesheet_submissions": _rows(db, "SELECT * FROM timesheet_submissions ORDER BY id"),
            "audit_events": _rows(db, "SELECT * FROM audit_events ORDER BY id"),
        }
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, rows in tables.items():
            zf.writestr(f"{name}.csv", _table_csv(rows))
    filename = f"swiftshift-company-export-{datetime.utcnow().date().isoformat()}.zip"
    return _attachment(zip_buf.getvalue(), filename, "application/zip")
