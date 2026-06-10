"""Manager-only reporting: real aggregates from clock_sessions + time_entries + users."""
from datetime import date, datetime

from flask import Blueprint, jsonify, request

from db import get_db
from permissions import current_uid, manager_required

bp = Blueprint("reports", __name__)

_DAILY_OT_THRESHOLD = 8.0    # hours per day before overtime
_WEEKLY_OT_THRESHOLD = 40.0  # hours per week before overtime
_OT_PREMIUM = 0.5            # overtime paid at 1.5x = base + 0.5x premium
_DEFAULT_HOURLY_RATE = 20.0  # matches users.hourly_rate column default


def _parse_range():
    """Return (start, end) as YYYY-MM-DD strings, defaulting to the current month."""
    today = date.today()
    start = request.args.get("start") or today.replace(day=1).isoformat()
    end = request.args.get("end") or today.isoformat()
    try:
        datetime.strptime(start, "%Y-%m-%d")
        datetime.strptime(end, "%Y-%m-%d")
    except ValueError:
        return None, None
    return start, end


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts).
    Copied from users.py per convention (no cross-blueprint imports)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


def _company_scope(db, daily, users):
    """Restrict daily hours + users to the viewer's company, mirroring
    payments._compute_items. Legacy viewers (company_id NULL) keep the
    original global behavior."""
    viewer_company = _viewer_company_id(db, current_uid())
    if viewer_company is None:
        return daily, users
    company_uids = {
        r["id"]
        for r in db.execute(
            "SELECT id FROM users WHERE company_id = ?", (viewer_company,)
        ).fetchall()
    }
    daily = {k: v for k, v in daily.items() if k[0] in company_uids}
    users = {uid: u for uid, u in users.items() if uid in company_uids}
    return daily, users


def _daily_hours(db, start, end):
    """Per-user per-day worked hours in [start, end] from clock sessions + manual time entries."""
    hours = {}  # (employee_id, "YYYY-MM-DD") -> hours
    rows = db.execute(
        """
        SELECT employee_id, LEFT(clock_in, 10) AS day, SUM(duration_minutes) AS minutes
        FROM clock_sessions
        WHERE clock_out IS NOT NULL AND duration_minutes IS NOT NULL
          AND LEFT(clock_in, 10) BETWEEN ? AND ?
        GROUP BY employee_id, LEFT(clock_in, 10)
        """,
        (start, end),
    ).fetchall()
    rows += db.execute(
        """
        SELECT employee_id, date AS day, SUM(duration_minutes) AS minutes
        FROM time_entries
        WHERE duration_minutes IS NOT NULL AND date BETWEEN ? AND ?
        GROUP BY employee_id, date
        """,
        (start, end),
    ).fetchall()
    for r in rows:
        if r["employee_id"] is None or not r["day"]:
            continue
        key = (r["employee_id"], r["day"])
        hours[key] = hours.get(key, 0.0) + float(r["minutes"] or 0) / 60.0
    return hours


def _load_users(db):
    rows = db.execute(
        "SELECT id, first_name, last_name, job_role, hourly_rate FROM users"
    ).fetchall()
    return {r["id"]: r for r in rows}


def _user_name(users, uid):
    u = users.get(uid)
    return f"{u['first_name']} {u['last_name']}".strip() if u else f"User {uid}"


def _user_rate(users, uid):
    u = users.get(uid)
    return float(u["hourly_rate"]) if u and u["hourly_rate"] is not None else _DEFAULT_HOURLY_RATE


def _user_department(users, uid):
    u = users.get(uid)
    return (u["job_role"] if u else None) or "Unassigned"


def _week_key(day_str):
    """ISO year-week of a YYYY-MM-DD string (for the 40h/week overtime rule)."""
    iso = datetime.strptime(day_str, "%Y-%m-%d").date().isocalendar()
    return (iso[0], iso[1])


def _overtime_by_user_day(daily):
    """Per-(user, day) OT hours: over 8h/day or 40h/week, whichever is greater each week.
    When the weekly rule exceeds the sum of daily OT, the extra is allocated to the
    last days of the week (the hours past 40 are the ones worked latest)."""
    weeks = {}  # (uid, iso_week) -> [(day, hours), ...]
    for (uid, day), hrs in daily.items():
        weeks.setdefault((uid, _week_key(day)), []).append((day, hrs))
    ot_by_day = {}
    for (uid, _), entries in weeks.items():
        entries.sort()
        day_ot = {d: max(0.0, h - _DAILY_OT_THRESHOLD) for d, h in entries}
        weekly_ot = max(0.0, sum(h for _, h in entries) - _WEEKLY_OT_THRESHOLD)
        remaining = weekly_ot - sum(day_ot.values())
        for d, h in reversed(entries):
            if remaining <= 0:
                break
            extra = min(remaining, h - day_ot[d])
            day_ot[d] += extra
            remaining -= extra
        for d, _ in entries:
            ot_by_day[(uid, d)] = day_ot[d]
    return ot_by_day


def _overtime_by_user(daily):
    """Per-user OT hours, summed from the per-day allocation."""
    ot = {}
    for (uid, _), o in _overtime_by_user_day(daily).items():
        ot[uid] = ot.get(uid, 0.0) + o
    return ot


# GET /api/reports/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
@bp.route("/api/reports/summary", methods=["GET"])
def reports_summary():
    err = manager_required()
    if err:
        return err
    start, end = _parse_range()
    if not start:
        return jsonify({"error": "start and end must be YYYY-MM-DD"}), 400

    with get_db() as db:
        daily = _daily_hours(db, start, end)
        users = _load_users(db)
        daily, users = _company_scope(db, daily, users)

    ot_by_user = _overtime_by_user(daily)
    hours_by_user = {}
    for (uid, _), hrs in daily.items():
        hours_by_user[uid] = hours_by_user.get(uid, 0.0) + hrs

    total_cost = 0.0
    departments = {}
    for uid, hrs in hours_by_user.items():
        rate = _user_rate(users, uid)
        ot = ot_by_user.get(uid, 0.0)
        cost = hrs * rate + ot * rate * _OT_PREMIUM
        total_cost += cost
        dept = _user_department(users, uid)
        d = departments.setdefault(
            dept,
            {"department": dept, "hours": 0.0, "overtime_hours": 0.0, "labor_cost": 0.0, "employees": 0},
        )
        d["hours"] += hrs
        d["overtime_hours"] += ot
        d["labor_cost"] += cost
        d["employees"] += 1

    rollups = sorted(departments.values(), key=lambda d: -d["hours"])
    for d in rollups:
        d["hours"] = round(d["hours"], 2)
        d["overtime_hours"] = round(d["overtime_hours"], 2)
        d["labor_cost"] = round(d["labor_cost"], 2)

    return jsonify({
        "start": start,
        "end": end,
        "total_hours": round(sum(hours_by_user.values()), 2),
        "overtime_hours": round(sum(ot_by_user.values()), 2),
        "labor_cost": round(total_cost, 2),
        "active_employees": len(hours_by_user),
        "departments": rollups,
    })


# GET /api/reports/hours?start=YYYY-MM-DD&end=YYYY-MM-DD
@bp.route("/api/reports/hours", methods=["GET"])
def reports_hours():
    err = manager_required()
    if err:
        return err
    start, end = _parse_range()
    if not start:
        return jsonify({"error": "start and end must be YYYY-MM-DD"}), 400

    with get_db() as db:
        daily = _daily_hours(db, start, end)
        users = _load_users(db)
        daily, users = _company_scope(db, daily, users)

    ot_by_day = _overtime_by_user_day(daily)
    rows = []
    for (uid, day), hrs in sorted(daily.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        rate = _user_rate(users, uid)
        ot = ot_by_day.get((uid, day), 0.0)
        rows.append({
            "user_id": uid,
            "name": _user_name(users, uid),
            "department": _user_department(users, uid),
            "date": day,
            "hours": round(hrs, 2),
            "overtime_hours": round(ot, 2),
            "hourly_rate": rate,
            "cost": round(hrs * rate + ot * rate * _OT_PREMIUM, 2),
        })
    return jsonify(rows)
