"""One-click data export: the logged-in user's data as JSON/CSV, plus a manager-only company zip."""
import csv
import io
import json
import zipfile
from datetime import datetime, timezone

from flask import Blueprint, Response, jsonify, request

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


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


def _rows(db, sql, params=()):
    return [dict(r) for r in db.execute(sql, params).fetchall()]


def _strip_password(user_row):
    return {k: v for k, v in dict(user_row).items() if k != "password_hash"}


def _csv_safe(value):
    """Guard against CSV formula injection: Excel/Sheets execute cells starting
    with =, +, -, or @ as formulas, so prefix string cells with a single quote.
    Non-string values (numbers, dates) are passed through untouched."""
    if value is None:
        return ""
    if isinstance(value, str) and value and value[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


def _table_csv(rows):
    """Render a list of row dicts as a CSV string (column order from the query)."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    if rows:
        headers = list(rows[0].keys())
        writer.writerow(headers)
        for r in rows:
            writer.writerow([_csv_safe(r.get(h)) for h in headers])
    return buf.getvalue()


def _attachment(body, filename, mimetype):
    return Response(
        body,
        mimetype=mimetype,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Minimal stdlib .xlsx writer (no openpyxl / third-party dep). A .xlsx is just
# a ZIP of XML parts; inline strings (t="inlineStr") keep us clear of the
# sharedStrings table and are read fine by Excel 2007+, Numbers and Sheets.
# ---------------------------------------------------------------------------

def _xlsx_safe(value):
    """Guard xlsx cell text against spreadsheet formula injection (same rule as
    _csv_safe): prefix a leading =,+,-,@ etc. with a single quote."""
    if value is None:
        return ""
    s = str(value)
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


def _xml_escape(s):
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _col_letter(idx):
    """0-based column index -> spreadsheet column letters (A, B, ..., Z, AA, ...)."""
    letters = ""
    idx += 1
    while idx:
        idx, rem = divmod(idx - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def _build_xlsx(headers, rows, sheet_name="Timecards"):
    """Return the bytes of a one-sheet .xlsx workbook.

    headers: list[str]; rows: list[list[str|int|float|None]].
    Numeric cells are stored as numbers (so Excel can sum/sort); the rest as
    formula-guarded inline strings."""
    def _cell(col_idx, row_idx, value, style=None):
        ref = f"{_col_letter(col_idx)}{row_idx}"
        s_attr = f' s="{style}"' if style is not None else ""
        if isinstance(value, bool):
            value = str(value)
        if isinstance(value, (int, float)):
            return f'<c r="{ref}"{s_attr}><v>{value}</v></c>'
        text = _xml_escape(_xlsx_safe(value))
        return f'<c r="{ref}"{s_attr} t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'

    rows_xml = ['<row r="1">' + "".join(_cell(ci, 1, h, style=1) for ci, h in enumerate(headers)) + "</row>"]
    for ri, row in enumerate(rows, start=2):
        rows_xml.append(f'<row r="{ri}">' + "".join(_cell(ci, ri, v) for ci, v in enumerate(row)) + "</row>")

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<sheetData>" + "".join(rows_xml) + "</sheetData></worksheet>"
    )
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        "</cellXfs>"
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        "</styleSheet>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{_xml_escape(sheet_name)}" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    wb_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/styles.xml", styles_xml)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buf.getvalue()


_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


# GET /api/export/timecards.xlsx?employee_id=<id|all>&start=YYYY-MM-DD&end=YYYY-MM-DD
@bp.route("/api/export/timecards.xlsx", methods=["GET"])
def export_timecards_xlsx():
    """Manager-only: clock-in / clock-out data as an Excel workbook.

    employee_id=all (default) -> every employee in the manager's company.
    employee_id=<n>           -> a single employee (must be in the same company).
    start / end               -> YYYY-MM-DD range (default: current calendar month).
    """
    err = manager_required()
    if err:
        return err

    from datetime import date as _date
    today = _date.today()
    start = request.args.get("start") or today.replace(day=1).isoformat()
    end = request.args.get("end") or today.isoformat()
    try:
        datetime.strptime(start, "%Y-%m-%d")
        datetime.strptime(end, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "start and end must be YYYY-MM-DD"}), 400

    emp_param = request.args.get("employee_id", "all")
    single_emp_id = None
    if emp_param != "all":
        try:
            single_emp_id = int(emp_param)
        except (ValueError, TypeError):
            return jsonify({"error": "employee_id must be an integer or 'all'"}), 400

    headers = ["Employee", "Email", "Date", "Clock In", "Clock Out", "Hours Worked", "Break (min)", "Notes"]

    with get_db() as db:
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            member_ids_sql = "SELECT id FROM users WHERE company_id = ?"
            member_params = (viewer_company,)
        else:
            member_ids_sql = "SELECT id FROM users"
            member_params = ()

        if single_emp_id is not None:
            belongs = db.execute(
                f"SELECT 1 FROM users WHERE id = ? AND id IN ({member_ids_sql})",
                (single_emp_id,) + member_params,
            ).fetchone()
            if not belongs:
                return jsonify({"error": "employee not found in your company"}), 404
            user_rows = db.execute(
                "SELECT id, first_name, last_name, email FROM users WHERE id = ?",
                (single_emp_id,),
            ).fetchall()
        else:
            user_rows = db.execute(
                f"SELECT id, first_name, last_name, email FROM users WHERE id IN ({member_ids_sql}) ORDER BY last_name, first_name",
                member_params,
            ).fetchall()

        user_map = {
            r["id"]: {
                "name": f"{r['first_name'] or ''} {r['last_name'] or ''}".strip() or (r["email"] or f"User {r['id']}"),
                "email": r["email"] or "",
            }
            for r in user_rows
        }
        uid_list = list(user_map.keys())

        sessions, entries = [], []
        if uid_list:
            placeholders = ",".join("?" * len(uid_list))
            sessions = db.execute(
                f"""
                SELECT employee_id, COALESCE(local_date, LEFT(clock_in, 10)) AS day, clock_in, clock_out,
                       duration_minutes, break_minutes, notes
                FROM clock_sessions
                WHERE employee_id IN ({placeholders})
                  AND COALESCE(local_date, LEFT(clock_in, 10)) BETWEEN ? AND ?
                ORDER BY employee_id, clock_in
                """,
                uid_list + [start, end],
            ).fetchall()
            entries = db.execute(
                f"""
                SELECT employee_id, date AS day, start_time AS clock_in, end_time AS clock_out,
                       duration_minutes, NULL AS break_minutes, description AS notes
                FROM time_entries
                WHERE employee_id IN ({placeholders})
                  AND date BETWEEN ? AND ?
                ORDER BY employee_id, date, start_time
                """,
                uid_list + [start, end],
            ).fetchall()

    data_rows = []
    for r in list(sessions) + list(entries):
        info = user_map.get(r["employee_id"], {"name": f"User {r['employee_id']}", "email": ""})
        mins = r["duration_minutes"]
        hours = round(float(mins) / 60, 2) if mins is not None else ""
        brk = r["break_minutes"] if r["break_minutes"] is not None else 0
        data_rows.append([
            info["name"], info["email"], (r["day"] or "")[:10],
            (r["clock_in"] or "")[:19], (r["clock_out"] or "")[:19],
            hours, brk, r["notes"],
        ])
    data_rows.sort(key=lambda row: (row[2], str(row[0])))

    filename = f"timecards-{start}-to-{end}.xlsx"
    return _attachment(_build_xlsx(headers, data_rows), filename, _XLSX_MIME)


# GET /api/export/me - everything the logged-in user owns, as one JSON bundle
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
            "exported_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "profile": _strip_password(profile) if profile else None,
            "clock_sessions": _rows(db, "SELECT * FROM clock_sessions WHERE employee_id = ? ORDER BY clock_in DESC", (uid,)),
            "time_entries": _rows(db, "SELECT * FROM time_entries WHERE employee_id = ? ORDER BY date DESC, start_time DESC", (uid,)),
            "pto_balance": dict(balance) if balance else None,
            "pto_requests": _rows(db, "SELECT * FROM pto_requests WHERE user_id = ? ORDER BY created_at DESC", (uid,)),
            "shift_swaps": _rows(db, "SELECT * FROM shift_swaps WHERE requester_id = ? OR target_id = ? ORDER BY shift_date DESC", (uid, uid)),
            "timesheet_submissions": _rows(db, "SELECT * FROM timesheet_submissions WHERE user_id = ? ORDER BY period_start DESC", (uid,)),
        }
    filename = f"swiftshift-my-data-{datetime.now(timezone.utc).replace(tzinfo=None).date().isoformat()}.json"
    return _attachment(json.dumps(bundle, indent=2, default=str), filename, "application/json")


# GET /api/export/me.csv - the logged-in user's time data (clock sessions + manual entries)
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
            s["duration_minutes"] if s["duration_minutes"] is not None else "", s["break_minutes"] or 0, "", "", _csv_safe(s["notes"]),
        ])
    for e in entries:
        writer.writerow([
            "time_entry", e["id"], e["date"] or "", e["start_time"] or "", e["end_time"] or "",
            e["duration_minutes"] if e["duration_minutes"] is not None else "", "", _csv_safe(e["project"]), _csv_safe(e["task"]), _csv_safe(e["description"]),
        ])
    filename = f"swiftshift-my-time-{datetime.now(timezone.utc).replace(tzinfo=None).date().isoformat()}.csv"
    return _attachment(buf.getvalue(), filename, "text/csv")


# GET /api/export/company - manager-only zip of per-table CSVs for all users
@bp.route("/api/export/company", methods=["GET"])
def export_company():
    err = manager_required()
    if err:
        return err
    with get_db() as db:
        _ensure_tables(db)
        viewer_company = _viewer_company_id(db, current_uid())
        if viewer_company is not None:
            # Company managers only export their own company's data.
            member_ids = "(SELECT id FROM users WHERE company_id = ?)"
            tables = {
                "users": [
                    _strip_password(r)
                    for r in db.execute("SELECT * FROM users WHERE company_id = ? ORDER BY id", (viewer_company,)).fetchall()
                ],
                "clock_sessions": _rows(db, f"SELECT * FROM clock_sessions WHERE employee_id IN {member_ids} ORDER BY id", (viewer_company,)),
                "time_entries": _rows(db, f"SELECT * FROM time_entries WHERE employee_id IN {member_ids} ORDER BY id", (viewer_company,)),
                "pto_balances": _rows(db, f"SELECT * FROM pto_balances WHERE user_id IN {member_ids} ORDER BY user_id", (viewer_company,)),
                "pto_requests": _rows(db, f"SELECT * FROM pto_requests WHERE user_id IN {member_ids} ORDER BY id", (viewer_company,)),
                "shift_swaps": _rows(db, f"SELECT * FROM shift_swaps WHERE requester_id IN {member_ids} OR target_id IN {member_ids} ORDER BY id", (viewer_company, viewer_company)),
                "timesheet_submissions": _rows(db, f"SELECT * FROM timesheet_submissions WHERE user_id IN {member_ids} ORDER BY id", (viewer_company,)),
                "audit_events": _rows(db, f"SELECT * FROM audit_events WHERE user_id IN {member_ids} ORDER BY id", (viewer_company,)),
            }
        else:
            # Legacy pre-company managers keep the original global export.
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
    filename = f"swiftshift-company-export-{datetime.now(timezone.utc).replace(tzinfo=None).date().isoformat()}.zip"
    return _attachment(zip_buf.getvalue(), filename, "application/zip")
