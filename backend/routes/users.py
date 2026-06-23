import json

from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from audit import log_event
from db import get_db
from permissions import current_uid, is_manager, manager_required

bp = Blueprint("users", __name__)


_USER_COLS = "id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary, hourly_rate, pto_accrual_rate, streak_count, streak_last_date, is_manager, company_id"

# Fields only a manager (or the user viewing their own record) may see.
_SENSITIVE = ("pay", "salary", "hourly_rate")
# Fields only a manager may change (even on their own record).
_MANAGER_ONLY_FIELDS = {"pay", "salary", "hourly_rate", "job_role", "is_manager", "pto_accrual_rate", "is_fulltime"}


def _viewer_company_id(db, uid):
    """The viewer's own company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


def _redact(row, viewer_uid, viewer_is_manager, viewer_company_id=None):
    """Hide pay/salary/hourly_rate unless the viewer is a same-company manager
    or it's their own row. Legacy (NULL-company) viewers count as one tenant:
    they match only other NULL-company rows."""
    d = dict(row)
    same_company = d.get("company_id") == viewer_company_id
    if (viewer_is_manager and same_company) or d.get("id") == viewer_uid:
        return d
    return {k: (None if k in _SENSITIVE else v) for k, v in d.items()}


@bp.route("/api/users", methods=["GET"])
def list_users():
    viewer = current_uid()
    viewer_is_manager = is_manager(viewer)
    with get_db() as db:
        viewer_company = _viewer_company_id(db, viewer)
        if viewer_company is not None:
            # Company accounts only ever see their own company's roster.
            rows = db.execute(
                f"SELECT {_USER_COLS} FROM users WHERE company_id = ? ORDER BY id",
                (viewer_company,),
            ).fetchall()
        else:
            # Legacy pre-company viewers are their own tenant: they see only
            # other NULL-company accounts, never company rosters. (Every fresh
            # signup starts with company_id NULL, so the old global fallback
            # let any new account enumerate the entire user table.)
            rows = db.execute(
                f"SELECT {_USER_COLS} FROM users WHERE company_id IS NULL ORDER BY id"
            ).fetchall()
    return jsonify([_redact(r, viewer, viewer_is_manager, viewer_company) for r in rows])


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
    if not isinstance(password, str) or len(password) < 8:
        # Same rule as /api/auth/signup - the admin path must not mint weaker accounts.
        return jsonify({"error": "password must be at least 8 characters"}), 400
    pw_hash = generate_password_hash(password)
    with get_db() as db:
        # Stamp the new account with the creating manager's company so it
        # appears in (and only in) that company's roster and stays editable
        # by its managers (NULL = legacy pre-company tenant).
        company_id = _viewer_company_id(db, current_uid())
        try:
            row = db.execute(
                f"""INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime, company_id)
                   VALUES (?, ?, ?, ?, 1, ?)
                   RETURNING {_USER_COLS}""",
                (first_name, last_name, email, pw_hash, company_id),
            ).fetchone()
            db.commit()
        except Exception as e:
            # Only report duplicates as duplicates; let real DB failures surface
            # as 500s instead of a misleading "email already exists".
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                return jsonify({"error": "email already exists"}), 409
            raise
    return jsonify(dict(row)), 201


@bp.route("/api/users/<int:target_id>", methods=["GET"])
def get_user(target_id):
    viewer = current_uid()
    viewer_is_manager = is_manager(viewer)
    with get_db() as db:
        viewer_company = _viewer_company_id(db, viewer)
        if viewer_company is not None:
            # Company accounts can only look up their own company's users.
            row = db.execute(
                f"SELECT {_USER_COLS} FROM users WHERE id = ? AND company_id = ?",
                (target_id, viewer_company),
            ).fetchone()
        else:
            # Legacy (NULL-company) viewers can look up themselves and other
            # NULL-company accounts only - never company-scoped users.
            row = db.execute(
                f"SELECT {_USER_COLS} FROM users WHERE id = ? AND company_id IS NULL",
                (target_id,),
            ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(_redact(row, viewer, viewer_is_manager, viewer_company))


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

    # Pay, role, and admin status are manager-only - even on your own record.
    if not caller_is_manager and any(f in fields for f in _MANAGER_ONLY_FIELDS):
        return jsonify({"error": "manager access required to change pay, role, or admin status"}), 403

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [target_id]
    with get_db() as db:
        caller_company = _viewer_company_id(db, caller)
        target = db.execute(
            "SELECT company_id FROM users WHERE id = ?", (target_id,)
        ).fetchone()
        if not target:
            return jsonify({"error": "not found"}), 404
        # Managers may only edit users in their own tenant (NULL-company
        # callers match only NULL-company targets); editing yourself is
        # always allowed.
        if not editing_self and target["company_id"] != caller_company:
            return jsonify({"error": "not found"}), 404
        db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
        db.commit()
        sensitive_changed = sorted(f for f in fields if f in _MANAGER_ONLY_FIELDS)
        row = db.execute(
            f"SELECT {_USER_COLS} FROM users WHERE id = ?",
            (target_id,),
        ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    if sensitive_changed:
        # Pay, role, and admin-status changes belong in the audit trail.
        log_event(caller, None, "user_update",
                  f"Changed {', '.join(sensitive_changed)} on user #{target_id}")
    return jsonify(_redact(row, caller, caller_is_manager, caller_company))


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
        row = db.execute(
            "SELECT id, company_id FROM users WHERE id = ?", (target_id,)
        ).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        # Managers may only delete users in their own tenant (NULL-company
        # callers match only NULL-company targets); deleting yourself is
        # always allowed.
        if caller != target_id:
            caller_company = _viewer_company_id(db, caller)
            if row["company_id"] != caller_company:
                return jsonify({"error": "not found"}), 404
        db.execute("DELETE FROM users WHERE id = ?", (target_id,))
        db.commit()
    log_event(caller, None, "user_delete", f"Deleted user #{target_id}")
    return jsonify({"ok": True})
