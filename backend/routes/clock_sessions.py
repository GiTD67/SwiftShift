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
    now = datetime.utcnow()
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
    return jsonify([dict(r) for r in rows])


@bp.route("/api/clock-sessions", methods=["POST"])
def clock_in():
    data = request.get_json() or {}
    employee_id = current_uid()
    if not employee_id:
        return jsonify({"error": "authentication required"}), 401
    now = _resolve_punch_ts(data.get("client_ts")).isoformat()
    with get_db() as db:
        row = db.execute(
            "INSERT INTO clock_sessions (employee_id, clock_in, notes) VALUES (?, ?, ?) RETURNING *",
            (employee_id, now, data.get("notes")),
        ).fetchone()
        db.commit()
    log_event(employee_id, None, "clock_in", f"Clocked in (session #{row['id']})")
    return jsonify(dict(row)), 201


def _compute_session_duration(clock_in_str: str, until=None) -> int:
    clock_in = datetime.fromisoformat(clock_in_str)
    return int(((until or datetime.utcnow()) - clock_in).total_seconds() / 60)


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
        total_minutes = max(0, _compute_session_duration(row["clock_in"], punch_ts))
        net_minutes = max(0, total_minutes - unpaid_break_minutes)
        db.execute(
            "UPDATE clock_sessions SET clock_out = ?, duration_minutes = ?, break_minutes = ? WHERE id = ?",
            (now, net_minutes, unpaid_break_minutes, session_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM clock_sessions WHERE id = ?", (session_id,)).fetchone()
    log_event(current_uid(), None, "clock_out", f"Clocked out (session #{session_id}, {net_minutes} min worked)")
    return jsonify(dict(row))
