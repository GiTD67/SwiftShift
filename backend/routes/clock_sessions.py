from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from audit import log_event
from db import get_db
from permissions import current_uid

bp = Blueprint("clock_sessions", __name__)


def _resolve_punch_ts(client_ts):
    """Punch time for a clock in/out. Uses the client-supplied timestamp (sent
    when an offline-queued punch is replayed) only if it's valid: parseable,
    not in the future, and not older than 24 hours. Falls back to server time."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if client_ts:
        try:
            ts = datetime.fromisoformat(str(client_ts).replace("Z", "+00:00"))
        except ValueError:
            return now
        if ts.tzinfo is not None:
            ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
        if now - timedelta(hours=24) <= ts <= now:
            return ts
    return now


def _serialize_session(row):
    """Return a clock session as a JSON-ready dict with its timestamps marked UTC.

    Timestamps are stored as naive UTC strings (no zone designator). A browser
    parses a zone-less datetime as LOCAL time, which shifts every punch by the
    viewer's UTC offset - for users behind UTC that pushes an open session into
    the future and zeroes the live timer on refresh. Append 'Z' so clients read
    them as UTC; leave any value that already carries a zone (e.g. a correction
    stored with '+00:00') untouched. Use only for full datetime columns: a
    date-only value has no time part and would be wrongly suffixed."""
    d = dict(row)
    for k in ("clock_in", "clock_out"):
        v = d.get(k)
        if v:
            s = str(v)
            tail = s[10:]  # the time portion, after the YYYY-MM-DD date
            if "Z" not in tail and "+" not in tail and "-" not in tail:
                d[k] = s + "Z"
    return d


@bp.route("/api/clock-sessions", methods=["GET"])
def list_clock_sessions():
    employee_id = current_uid()  # only ever your own sessions
    active_only = request.args.get("active") == "1"
    with get_db() as db:
        sql = "SELECT * FROM clock_sessions"
        params = []
        where = []
        if employee_id:
            where.append("employee_id = ?")
            params.append(employee_id)
        if active_only:
            where.append("clock_out IS NULL")
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY clock_in DESC"
        rows = db.execute(sql, params).fetchall()
    return jsonify([_serialize_session(r) for r in rows])


@bp.route("/api/clock-sessions", methods=["POST"])
def clock_in():
    data = request.get_json() or {}
    employee_id = current_uid()
    if not employee_id:
        return jsonify({"error": "authentication required"}), 401
    now = _resolve_punch_ts(data.get("client_ts")).isoformat()
    with get_db() as db:
        # Idempotent: a double-tap, second device, or replayed offline punch
        # must not open a second concurrent session (each would later be
        # closed for its full duration - double-counted paid time). Only
        # recent sessions are reused: a forgotten open session from yesterday
        # should stay open so the missed-clockout flag surfaces it for
        # correction, not silently absorb today's shift.
        existing = db.execute(
            "SELECT * FROM clock_sessions WHERE employee_id = ? AND clock_out IS NULL ORDER BY id DESC",
            (employee_id,),
        ).fetchone()
        if existing:
            try:
                recent = datetime.now(timezone.utc).replace(tzinfo=None) - datetime.fromisoformat(str(existing["clock_in"])) <= timedelta(hours=20)
            except (TypeError, ValueError):
                recent = True
            if recent:
                return jsonify(_serialize_session(existing)), 200
        # local_date is the employee's local calendar day at punch time, captured
        # by the client (NULL for legacy/offline callers; reports COALESCE to the
        # UTC date prefix until backfilled).
        local_date = data.get("local_date")
        row = db.execute(
            "INSERT INTO clock_sessions (employee_id, clock_in, notes, local_date) VALUES (?, ?, ?, ?) RETURNING *",
            (employee_id, now, data.get("notes"), local_date),
        ).fetchone()
        db.commit()
    log_event(employee_id, None, "clock_in", f"Clocked in (session #{row['id']})")
    return jsonify(_serialize_session(row)), 201


def _compute_session_duration(clock_in_str: str, until=None) -> int:
    clock_in = datetime.fromisoformat(clock_in_str)
    return int(((until or datetime.now(timezone.utc).replace(tzinfo=None)) - clock_in).total_seconds() / 60)


@bp.route("/api/clock-sessions/<int:session_id>", methods=["PUT"])
def clock_out(session_id):
    data = request.get_json() or {}
    try:
        unpaid_break_minutes = max(0, int(data.get("break_minutes", 0) or 0))
    except (TypeError, ValueError):
        return jsonify({"error": "break_minutes must be a number"}), 400
    punch_ts = _resolve_punch_ts(data.get("client_ts"))
    now = punch_ts.isoformat()
    with get_db() as db:
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        if row["employee_id"] != current_uid():
            return jsonify({"error": "forbidden"}), 403
        if row["clock_out"]:
            return jsonify({"error": "already clocked out"}), 400
        try:
            # A replayed offline punch can carry a timestamp older than the
            # clock-in; never store a session that ends before it starts.
            clock_in_dt = datetime.fromisoformat(row["clock_in"])
            if punch_ts < clock_in_dt:
                punch_ts = clock_in_dt
                now = punch_ts.isoformat()
        except (TypeError, ValueError):
            pass
        total_minutes = max(0, _compute_session_duration(row["clock_in"], punch_ts))
        net_minutes = max(0, total_minutes - unpaid_break_minutes)
        db.execute(
            "UPDATE clock_sessions SET clock_out = ?, duration_minutes = ?, break_minutes = ? WHERE id = ?",
            (now, net_minutes, unpaid_break_minutes, session_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
    log_event(current_uid(), None, "clock_out", f"Clocked out (session #{session_id}, {net_minutes} min worked)")
    return jsonify(_serialize_session(row))
