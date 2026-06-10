import json

from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from db import get_db
from permissions import current_uid, is_manager, manager_required

bp = Blueprint("users", __name__)


_USER_COLS = "id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary, hourly_rate, pto_accrual_rate, streak_count, streak_last_date, is_manager"

# Fields only a manager (or the user viewing their own record) may see.
_SENSITIVE = ("pay", "salary", "hourly_rate")
# Fields only a manager may change (even on their own record).
_MANAGER_ONLY_FIELDS = {"pay", "salary", "hourly_rate", "job_role", "is_manager"}


def _redact(row, viewer_uid, viewer_is_manager):
    """Hide pay/salary/hourly_rate unless the viewer is a manager or it's their own row."""
    d = dict(row)
    if viewer_is_manager or d.get("id") == viewer_uid:
        return d
    return {k: (None if k in _SENSITIVE else v) for k, v in d.items()}


@bp.route("/api/users", methods=["GET"])
def list_users():
    viewer = current_uid()
    viewer_is_manager = is_manager(viewer)
    with get_db() as db:
        rows = db.execute(f"SELECT {_USER_COLS} FROM users ORDER BY id").fetchall()
    return jsonify([_redact(r, viewer, viewer_is_manager) for r in rows])


@bp.route("/api/users", methods=["POST"])
def create_user():
    # Creating accounts is an admin action; public signup goes through /api/auth/signup.
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")
    if not first_name or not last_name or not email:
        return jsonify({"error": "first_name, last_name, email required"}), 400
    if not password:
        return jsonify({"error": "password required"}), 400
    pw_hash = generate_password_hash(password)
    with get_db() as db:
        try:
            row = db.execute(
                f"""INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime)
                   VALUES (?, ?, ?, ?, 1)
                   RETURNING {_USER_COLS}""",
                (first_name, last_name, email, pw_hash),
            ).fetchone()
            db.commit()
        except Exception:
            return jsonify({"error": "email already exists"}), 409
    return jsonify(dict(row)), 201


@bp.route("/api/users/<int:target_id>", methods=["GET"])
def get_user(target_id):
    viewer = current_uid()
    viewer_is_manager = is_manager(viewer)
    with get_db() as db:
        row = db.execute(
            f"SELECT {_USER_COLS} FROM users WHERE id = ?",
            (target_id,),
        ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(_redact(row, viewer, viewer_is_manager))


@bp.route("/api/users/<int:target_id>", methods=["PUT"])
def update_user(target_id):
    caller = current_uid()
    caller_is_manager = is_manager(caller)
    editing_self = caller == target_id

    # Only a manager may edit someone else's account.
    if not editing_self and not caller_is_manager:
        return jsonify({"error": "manager access required"}), 403

    data = request.get_json() or {}
    allowed = {"job_role", "manager_name", "is_fulltime", "pay", "salary", "hourly_rate", "pto_accrual_rate", "streak_count", "streak_last_date", "is_manager"}
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return jsonify({"error": "no updatable fields provided"}), 400

    # Pay, role, and admin status are manager-only — even on your own record.
    if not caller_is_manager and any(f in fields for f in _MANAGER_ONLY_FIELDS):
        return jsonify({"error": "manager access required to change pay, role, or admin status"}), 403

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [target_id]
    with get_db() as db:
        db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
        db.commit()
        row = db.execute(
            f"SELECT {_USER_COLS} FROM users WHERE id = ?",
            (target_id,),
        ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(_redact(row, caller, caller_is_manager))


# ── Self-service profile (contact info + W-4 withholding) ────────────────────

_PROFILE_FIELDS = ("phone", "address_line1", "address_line2", "city", "state", "zip",
                   "emergency_contact_name", "emergency_contact_phone",
                   "filing_status", "extra_withholding")
_PROFILE_COLS = "id, first_name, last_name, email, " + ", ".join(_PROFILE_FIELDS)
_FILING_STATUSES = ("single", "married", "head_of_household")


@bp.route("/api/users/me/profile", methods=["GET"])
def get_my_profile():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        row = db.execute(
            f"SELECT {_PROFILE_COLS} FROM users WHERE id = ?", (uid,)
        ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(dict(row))


@bp.route("/api/users/me/profile", methods=["PUT"])
def update_my_profile():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    data = request.get_json() or {}
    fields = {k: v for k, v in data.items() if k in _PROFILE_FIELDS}
    if not fields:
        return jsonify({"error": "no updatable fields provided"}), 400
    if "filing_status" in fields and fields["filing_status"] not in _FILING_STATUSES:
        return jsonify({"error": f"filing_status must be one of: {', '.join(_FILING_STATUSES)}"}), 400
    if "extra_withholding" in fields:
        try:
            fields["extra_withholding"] = max(0.0, float(fields["extra_withholding"] or 0))
        except (TypeError, ValueError):
            return jsonify({"error": "extra_withholding must be a number"}), 400
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    with get_db() as db:
        db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", list(fields.values()) + [uid])
        db.commit()
        row = db.execute(
            f"SELECT {_PROFILE_COLS} FROM users WHERE id = ?", (uid,)
        ).fetchone()
    return jsonify(dict(row))


# ── Notification preferences (per-category toggles + instant/daily-digest mode) ──

_NOTIF_CATEGORIES = ("pto", "swaps", "timesheet", "manager")
_NOTIF_MODES = ("instant", "digest")
_NOTIF_DEFAULTS = {"pto": True, "swaps": True, "timesheet": True, "manager": True, "mode": "instant"}


def _load_notif_prefs(db, uid):
    """Return the user's saved prefs merged over the defaults, or None if the user is gone."""
    db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs TEXT")
    row = db.execute("SELECT notification_prefs FROM users WHERE id = ?", (uid,)).fetchone()
    if not row:
        return None
    prefs = dict(_NOTIF_DEFAULTS)
    try:
        saved = json.loads(row["notification_prefs"] or "{}")
        if isinstance(saved, dict):
            for cat in _NOTIF_CATEGORIES:
                if cat in saved:
                    prefs[cat] = bool(saved[cat])
            if saved.get("mode") in _NOTIF_MODES:
                prefs["mode"] = saved["mode"]
    except (TypeError, ValueError):
        pass
    return prefs


@bp.route("/api/users/me/notification-prefs", methods=["GET"])
def get_my_notification_prefs():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        prefs = _load_notif_prefs(db, uid)
        db.commit()
    if prefs is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(prefs)


@bp.route("/api/users/me/notification-prefs", methods=["PUT"])
def update_my_notification_prefs():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    data = request.get_json() or {}
    if "mode" in data and data["mode"] not in _NOTIF_MODES:
        return jsonify({"error": f"mode must be one of: {', '.join(_NOTIF_MODES)}"}), 400
    with get_db() as db:
        prefs = _load_notif_prefs(db, uid)
        if prefs is None:
            return jsonify({"error": "not found"}), 404
        for cat in _NOTIF_CATEGORIES:
            if cat in data:
                prefs[cat] = bool(data[cat])
        if "mode" in data:
            prefs["mode"] = data["mode"]
        db.execute("UPDATE users SET notification_prefs = ? WHERE id = ?", (json.dumps(prefs), uid))
        db.commit()
    return jsonify(prefs)


@bp.route("/api/users/<int:target_id>", methods=["DELETE"])
def delete_user(target_id):
    caller = current_uid()
    # Only a manager may delete someone else's account.
    if caller != target_id and not is_manager(caller):
        return jsonify({"error": "manager access required"}), 403
    with get_db() as db:
        row = db.execute("SELECT id FROM users WHERE id = ?", (target_id,)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        db.execute("DELETE FROM users WHERE id = ?", (target_id,))
        db.commit()
    return jsonify({"ok": True})
