import math
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from audit import log_event
from db import get_db
from permissions import current_uid, manager_required

bp = Blueprint("org_settings", __name__)

_DDL = """
CREATE TABLE IF NOT EXISTS org_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  auto_approve_swap_hours REAL,
  ot_alert_daily_hours REAL NOT NULL DEFAULT 10,
  missed_clockout_hours REAL NOT NULL DEFAULT 12,
  updated_at TEXT NOT NULL DEFAULT (NOW()::text)
)
"""


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


def get_org_settings(db, company_id=None):
    """Return the company's settings row as a dict, creating it with defaults
    on first use. company_id None = the legacy pre-company tenant (the
    original id=1 row). Also used by shift_swaps for swap auto-approval."""
    db.execute(_DDL)
    # One settings row per company (company_id NULL = the legacy
    # pre-company deployment, mapped to 0 so it is unique too).
    db.execute("ALTER TABLE org_settings ADD COLUMN IF NOT EXISTS company_id INTEGER")
    db.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS org_settings_company_uniq
        ON org_settings ((COALESCE(company_id, 0)))
        """
    )
    row = db.execute(
        "SELECT * FROM org_settings WHERE company_id IS NOT DISTINCT FROM ?",
        (company_id,),
    ).fetchone()
    # Bare ON CONFLICT DO NOTHING also absorbs a PRIMARY KEY collision (two
    # first-time requests for different companies can compute the same
    # MAX(id)+1); in that case the fallback SELECT finds nothing for our
    # company, so retry with a freshly computed id.
    attempts = 0
    while not row and attempts < 3:
        attempts += 1
        row = db.execute(
            """
            INSERT INTO org_settings (id, company_id)
            VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM org_settings), ?)
            ON CONFLICT DO NOTHING
            RETURNING *
            """,
            (company_id,),
        ).fetchone()
        db.commit()
        if not row:  # lost a race with a concurrent request
            row = db.execute(
                "SELECT * FROM org_settings WHERE company_id IS NOT DISTINCT FROM ?",
                (company_id,),
            ).fetchone()
    return dict(row)


# GET /api/org-settings — any signed-in user can read their company's settings
@bp.route("/api/org-settings", methods=["GET"])
def get_settings():
    with get_db() as db:
        settings = get_org_settings(db, _viewer_company_id(db, current_uid()))
    return jsonify(settings)


# PUT /api/org-settings — manager-only
@bp.route("/api/org-settings", methods=["PUT"])
def update_settings():
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    with get_db() as db:
        current = get_org_settings(db, _viewer_company_id(db, current_uid()))

        # null disables swap auto-approval entirely
        auto_hours = data.get("auto_approve_swap_hours", current["auto_approve_swap_hours"])
        if auto_hours is not None:
            try:
                auto_hours = float(auto_hours)
            except (TypeError, ValueError):
                return jsonify({"error": "auto_approve_swap_hours must be a number or null"}), 400
            if not math.isfinite(auto_hours) or auto_hours < 0:
                return jsonify({"error": "auto_approve_swap_hours must be >= 0"}), 400
        try:
            ot_hours = float(data.get("ot_alert_daily_hours", current["ot_alert_daily_hours"]))
            missed_hours = float(data.get("missed_clockout_hours", current["missed_clockout_hours"]))
        except (TypeError, ValueError):
            return jsonify({"error": "ot_alert_daily_hours and missed_clockout_hours must be numbers"}), 400
        # NaN slips past a plain <= 0 check (all NaN comparisons are False) and
        # would silently disable OT / missed-clockout alerts once stored.
        if not math.isfinite(ot_hours) or not math.isfinite(missed_hours) or ot_hours <= 0 or missed_hours <= 0:
            return jsonify({"error": "ot_alert_daily_hours and missed_clockout_hours must be positive"}), 400

        db.execute(
            "UPDATE org_settings SET auto_approve_swap_hours = ?, ot_alert_daily_hours = ?, missed_clockout_hours = ?, updated_at = ? WHERE id = ?",
            (auto_hours, ot_hours, missed_hours, datetime.utcnow().isoformat(), current["id"]),
        )
        db.commit()
        row = db.execute(
            "SELECT * FROM org_settings WHERE id = ?", (current["id"],)
        ).fetchone()
    log_event(
        current_uid(), None, "org_settings_update",
        f"Workflow settings: auto-approve swaps {auto_hours if auto_hours is not None else 'off'}"
        f"{'h ahead' if auto_hours is not None else ''}, OT alert {ot_hours}h/day, missed clock-out {missed_hours}h",
    )
    return jsonify(dict(row))


def _parse_ts(value):
    """Parse a stored ISO timestamp to naive UTC, or None if unparseable."""
    try:
        ts = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if ts.tzinfo is not None:
        ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
    return ts


# GET /api/org-settings/flags — manager-only: clock sessions open longer than
# missed_clockout_hours, plus days where someone worked over ot_alert_daily_hours.
@bp.route("/api/org-settings/flags", methods=["GET"])
def get_flags():
    err = manager_required()
    if err:
        return err
    now = datetime.utcnow()
    with get_db() as db:
        viewer_company = _viewer_company_id(db, current_uid())
        settings = get_org_settings(db, viewer_company)
        missed_after = float(settings["missed_clockout_hours"] or 12)
        ot_daily = float(settings["ot_alert_daily_hours"] or 10)
        cutoff = (now - timedelta(days=30)).isoformat()
        if viewer_company is not None:
            # Company managers only see their own company's sessions.
            rows = db.execute(
                """
                SELECT cs.id, cs.employee_id, cs.clock_in, cs.clock_out, cs.duration_minutes,
                       u.first_name, u.last_name
                FROM clock_sessions cs
                LEFT JOIN users u ON u.id = cs.employee_id
                WHERE (cs.clock_out IS NULL OR cs.clock_in >= ?) AND u.company_id = ?
                ORDER BY cs.clock_in DESC
                """,
                (cutoff, viewer_company),
            ).fetchall()
        else:
            # Legacy pre-company viewers keep the original global behavior.
            rows = db.execute(
                """
                SELECT cs.id, cs.employee_id, cs.clock_in, cs.clock_out, cs.duration_minutes,
                       u.first_name, u.last_name
                FROM clock_sessions cs
                LEFT JOIN users u ON u.id = cs.employee_id
                WHERE cs.clock_out IS NULL OR cs.clock_in >= ?
                ORDER BY cs.clock_in DESC
                """,
                (cutoff,),
            ).fetchall()

    missed = []
    daily = {}  # (employee_id, date) -> [minutes, name]
    for r in rows:
        name = f"{r['first_name'] or ''} {r['last_name'] or ''}".strip() or None
        clock_in = _parse_ts(r["clock_in"])
        if not clock_in:
            continue
        if r["clock_out"] is None:
            open_hours = (now - clock_in).total_seconds() / 3600
            if open_hours >= missed_after:
                missed.append({
                    "session_id": r["id"],
                    "employee_id": r["employee_id"],
                    "employee_name": name,
                    "clock_in": r["clock_in"],
                    "open_hours": round(open_hours, 1),
                })
            minutes = max(0, (now - clock_in).total_seconds() / 60)  # still running
        else:
            minutes = r["duration_minutes"] or 0
        if str(r["clock_in"]) >= cutoff:
            entry = daily.setdefault((r["employee_id"], str(r["clock_in"])[:10]), [0, name])
            entry[0] += minutes

    ot = [
        {"employee_id": emp_id, "employee_name": name, "date": day, "hours": round(total / 60, 1)}
        for (emp_id, day), (total, name) in daily.items()
        if total / 60 > ot_daily
    ]
    ot.sort(key=lambda f: f["date"], reverse=True)
    return jsonify({"missed_clockouts": missed, "ot_alerts": ot, "settings": settings})
