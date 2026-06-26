"""Onboarding: companies, invite codes, and the first-run wizard endpoints.

A user with ``company_id NULL`` is either a brand-new account or a legacy
pre-company account; the status endpoint tells the frontend which wizard to
show. All company/invite queries are scoped to the caller's own
``users.company_id`` (fetched server-side from the session uid, never from the
request body), so one company can never read or mutate another's data.
"""
import secrets

from flask import Blueprint, jsonify, request

import auth  # noqa: F401  # ensures the users table exists before the ALTERs below
from db import get_db, safe_bootstrap
from mailer import APP_BASE_URL
from notifications import notify_invite
from permissions import current_uid, manager_required

bp = Blueprint("onboarding", __name__)

_COMPANY_COLS = "id, name, timezone, pay_period, overtime_policy, created_by, created_at"
_INVITE_COLS = "id, code, name, email, job_role, hourly_rate, status, created_at"

_PAY_PERIODS = ("weekly", "biweekly", "semimonthly", "monthly")
_OVERTIME_POLICIES = ("none", "weekly_40", "daily_8_weekly_40")

_BULK_MAX_ROWS = 200


def _ensure_tables():
    # Idempotent DDL run on every worker boot (same pattern as auth.py): a
    # failed statement would abort the whole transaction, so every statement
    # must be IF NOT EXISTS.
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS companies (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              timezone TEXT NOT NULL DEFAULT 'America/New_York',
              pay_period TEXT NOT NULL DEFAULT 'biweekly',
              overtime_policy TEXT NOT NULL DEFAULT 'weekly_40',
              created_by INTEGER NOT NULL,
              created_at TEXT NOT NULL DEFAULT (NOW()::text)
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS company_invites (
              id SERIAL PRIMARY KEY,
              company_id INTEGER NOT NULL,
              code TEXT UNIQUE NOT NULL,
              name TEXT NOT NULL,
              email TEXT,
              job_role TEXT,
              hourly_rate REAL,
              manager_id INTEGER NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              claimed_by INTEGER,
              created_at TEXT NOT NULL DEFAULT (NOW()::text),
              claimed_at TEXT
            )
            """
        )
        for col_def in (
            "company_id INTEGER",
            "onboarding_complete BOOLEAN DEFAULT FALSE",
        ):
            db.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_def}")
        # SaaS subscription / free-trial state lives on the company (per-workspace
        # billing). Added here because onboarding owns the companies table and
        # creates new companies; routes/billing.py only ever reads these columns.
        for col_def in (
            "plan TEXT NOT NULL DEFAULT 'starter'",
            "subscription_status TEXT NOT NULL DEFAULT 'trialing'",
            "trial_started_at TEXT",
            "trial_ends_at TEXT",
            "billing_customer_id TEXT",
            "billing_subscription_id TEXT",
        ):
            db.execute(f"ALTER TABLE companies ADD COLUMN IF NOT EXISTS {col_def}")
        # The 30-day free trial applies to every workspace, including ones that
        # predate billing. Any company with no trial timestamp yet (legacy /
        # pre-billing) is started on a fresh 30-day trial from now, so it shows a
        # real countdown and then converts to read-only until upgraded. We never
        # touch a company that has its own trial timestamp (new signups) or that
        # has ever engaged Stripe (a billing customer/subscription on record), so
        # paying customers are never reset, even ones whose subscription later
        # went canceled/past_due. After the first boot the timestamp is set, so
        # this is a no-op on every later boot (no trial reset / no trial farming).
        db.execute(
            "UPDATE companies SET subscription_status = 'trialing', plan = 'starter', "
            "trial_started_at = NOW()::text, "
            "trial_ends_at = (NOW() + INTERVAL '30 days')::text "
            "WHERE trial_started_at IS NULL AND billing_customer_id IS NULL "
            "AND billing_subscription_id IS NULL"
        )


safe_bootstrap(_ensure_tables)


# No I/L/O/0/1 - avoids ambiguous characters in hand-typed codes.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _gen_code():
    return "SW-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


def _user_company_id(db, uid):
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


def _validate_company_fields(data, require_name):
    """Return (fields, error_response). Only validates keys that are present
    (plus name when require_name)."""
    fields = {}
    if require_name or "name" in data:
        name = data.get("name")
        if not isinstance(name, str) or not name.strip():
            return None, (jsonify({"error": "name required"}), 400)
        name = name.strip()
        if len(name) > 120:
            return None, (jsonify({"error": "name too long (max 120 chars)"}), 400)
        fields["name"] = name
    if "timezone" in data:
        tz = data.get("timezone")
        if not isinstance(tz, str) or not tz.strip() or len(tz.strip()) > 64:
            return None, (jsonify({"error": "invalid timezone"}), 400)
        fields["timezone"] = tz.strip()
    if "pay_period" in data:
        if data.get("pay_period") not in _PAY_PERIODS:
            return None, (jsonify({"error": f"pay_period must be one of: {', '.join(_PAY_PERIODS)}"}), 400)
        fields["pay_period"] = data["pay_period"]
    if "overtime_policy" in data:
        if data.get("overtime_policy") not in _OVERTIME_POLICIES:
            return None, (jsonify({"error": f"overtime_policy must be one of: {', '.join(_OVERTIME_POLICIES)}"}), 400)
        fields["overtime_policy"] = data["overtime_policy"]
    return fields, None


def _validate_invite_row(data):
    """Return (clean_fields, error_message) for one invite row."""
    if not isinstance(data, dict):
        return None, "invalid row"
    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        return None, "name required"
    name = name.strip()
    if len(name) > 120:
        return None, "name too long (max 120 chars)"
    email = data.get("email")
    if email is not None and not isinstance(email, str):
        return None, "email must be a string"
    email = (email or "").strip() or None
    job_role = data.get("job_role")
    if job_role is not None and not isinstance(job_role, str):
        return None, "job_role must be a string"
    job_role = (job_role or "").strip() or None
    hourly_rate = data.get("hourly_rate")
    if hourly_rate is None or hourly_rate == "":
        hourly_rate = None
    else:
        try:
            hourly_rate = float(hourly_rate)
        except (TypeError, ValueError):
            return None, "hourly_rate must be a number"
        if hourly_rate < 0:
            return None, "hourly_rate must be >= 0"
    return {"name": name, "email": email, "job_role": job_role, "hourly_rate": hourly_rate}, None


def _create_invite(db, company_id, manager_id, name, email=None, job_role=None, hourly_rate=None):
    """INSERT an invite with a fresh code, retrying on the (astronomically
    unlikely) code collision. Uses a savepoint because in Postgres a failed
    INSERT aborts the surrounding transaction."""
    last_err = None
    for _ in range(5):
        code = _gen_code()
        db.execute("SAVEPOINT invite_insert")
        try:
            row = db.execute(
                f"""INSERT INTO company_invites (company_id, code, name, email, job_role, hourly_rate, manager_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   RETURNING {_INVITE_COLS}""",
                (company_id, code, name, email, job_role, hourly_rate, manager_id),
            ).fetchone()
            db.execute("RELEASE SAVEPOINT invite_insert")
            # Deliver the invite by email when an address was supplied. Best-effort:
            # notify_invite swallows its own errors so a mail failure never blocks
            # invite creation.
            if email:
                crow = db.execute("SELECT name FROM companies WHERE id = ?", (company_id,)).fetchone()
                company_name = crow["name"] if crow else None
                notify_invite(email, name, code, company_name, f"{APP_BASE_URL}/signup?invite={code}")
            return dict(row)
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                db.execute("ROLLBACK TO SAVEPOINT invite_insert")
                last_err = e
                continue
            raise
    raise last_err


# ── Status ────────────────────────────────────────────────────────────────────

@bp.route("/api/onboarding/status", methods=["GET"])
def onboarding_status():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        user = db.execute(
            "SELECT id, is_manager, company_id, onboarding_complete FROM users WHERE id = ?", (uid,)
        ).fetchone()
        if not user:
            return jsonify({"error": "not found"}), 404
        company = None
        if user["company_id"] is not None:
            row = db.execute(
                f"SELECT {_COMPANY_COLS} FROM companies WHERE id = ?", (user["company_id"],)
            ).fetchone()
            company = dict(row) if row else None
    user_is_manager = bool(user["is_manager"])
    complete = bool(user["onboarding_complete"])
    if user["company_id"] is None:
        needs = "manager_setup" if user_is_manager else "employee_link"
    elif not complete:
        needs = "manager_setup" if user_is_manager else "employee_wizard"
    else:
        needs = None
    return jsonify({
        "company": company,
        "is_manager": user_is_manager,
        "onboarding_complete": complete,
        "needs": needs,
    })


# ── Company ───────────────────────────────────────────────────────────────────

@bp.route("/api/onboarding/company", methods=["POST"])
def create_company():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    data = request.get_json() or {}
    fields, err = _validate_company_fields(data, require_name=True)
    if err:
        return err
    with get_db() as db:
        user = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
        if not user:
            return jsonify({"error": "not found"}), 404
        if user["company_id"] is not None:
            return jsonify({"error": "already in a company"}), 409
        # One transaction (commit on with-exit): the creator becomes a manager
        # of their own new company.
        # A new company starts a 30-day Pro free trial the moment it is created.
        # Recording trial_started_at here is also what keeps it out of the
        # grandfather UPDATE in _ensure_tables (which only touches NULL ones).
        company = db.execute(
            f"""INSERT INTO companies (name, timezone, pay_period, overtime_policy, created_by,
                                       plan, subscription_status, trial_started_at, trial_ends_at)
               VALUES (?, ?, ?, ?, ?, 'starter', 'trialing', NOW()::text, (NOW() + INTERVAL '30 days')::text)
               RETURNING {_COMPANY_COLS}""",
            (
                fields["name"],
                fields.get("timezone", "America/New_York"),
                fields.get("pay_period", "biweekly"),
                fields.get("overtime_policy", "weekly_40"),
                uid,
            ),
        ).fetchone()
        db.execute(
            "UPDATE users SET company_id = ?, is_manager = TRUE WHERE id = ?",
            (company["id"], uid),
        )
    return jsonify({"company": dict(company)}), 201


@bp.route("/api/onboarding/company", methods=["GET"])
def get_company():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        company_id = _user_company_id(db, uid)
        if company_id is None:
            return jsonify({"error": "no company"}), 404
        row = db.execute(f"SELECT {_COMPANY_COLS} FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not row:
        return jsonify({"error": "no company"}), 404
    return jsonify(dict(row))


@bp.route("/api/onboarding/company", methods=["PUT"])
def update_company():
    err = manager_required()
    if err:
        return err
    uid = current_uid()
    with get_db() as db:
        company_id = _user_company_id(db, uid)
        if company_id is None:
            return jsonify({"error": "no company"}), 404
        data = request.get_json() or {}
        fields, verr = _validate_company_fields(data, require_name=False)
        if verr:
            return verr
        if not fields:
            return jsonify({"error": "no updatable fields provided"}), 400
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        row = db.execute(
            f"UPDATE companies SET {set_clause} WHERE id = ? RETURNING {_COMPANY_COLS}",
            list(fields.values()) + [company_id],
        ).fetchone()
    if not row:
        return jsonify({"error": "no company"}), 404
    return jsonify(dict(row))


# ── Invites (manager side) ────────────────────────────────────────────────────

@bp.route("/api/onboarding/invites", methods=["POST"])
def create_invite():
    err = manager_required()
    if err:
        return err
    uid = current_uid()
    data = request.get_json() or {}
    clean, verr = _validate_invite_row(data)
    if verr:
        return jsonify({"error": verr}), 400
    with get_db() as db:
        company_id = _user_company_id(db, uid)
        if company_id is None:
            return jsonify({"error": "no company"}), 404
        invite = _create_invite(db, company_id, uid, **clean)
    return jsonify(invite), 201


@bp.route("/api/onboarding/invites/bulk", methods=["POST"])
def create_invites_bulk():
    err = manager_required()
    if err:
        return err
    uid = current_uid()
    data = request.get_json() or {}
    rows = data.get("invites")
    if not isinstance(rows, list) or not rows:
        return jsonify({"error": "invites must be a non-empty list"}), 400
    if len(rows) > _BULK_MAX_ROWS:
        return jsonify({"error": f"too many invites (max {_BULK_MAX_ROWS})"}), 400
    created = []
    errors = []
    with get_db() as db:
        company_id = _user_company_id(db, uid)
        if company_id is None:
            return jsonify({"error": "no company"}), 404
        for i, row in enumerate(rows):
            clean, verr = _validate_invite_row(row)
            if verr:
                name = row.get("name") if isinstance(row, dict) and isinstance(row.get("name"), str) else ""
                errors.append({"index": i, "name": name, "error": verr})
                continue
            created.append(_create_invite(db, company_id, uid, **clean))
    return jsonify({"created": created, "errors": errors})


@bp.route("/api/onboarding/invites", methods=["GET"])
def list_invites():
    err = manager_required()
    if err:
        return err
    uid = current_uid()
    with get_db() as db:
        company_id = _user_company_id(db, uid)
        if company_id is None:
            return jsonify({"error": "no company"}), 404
        rows = db.execute(
            """SELECT ci.id, ci.code, ci.name, ci.email, ci.job_role, ci.hourly_rate,
                      ci.status, ci.claimed_by, ci.created_at, ci.claimed_at,
                      u.first_name || ' ' || u.last_name AS claimed_by_name
               FROM company_invites ci
               LEFT JOIN users u ON u.id = ci.claimed_by
               WHERE ci.company_id = ?
               ORDER BY ci.id DESC""",
            (company_id,),
        ).fetchall()
    return jsonify({"invites": [dict(r) for r in rows]})


@bp.route("/api/onboarding/invites/<int:invite_id>", methods=["DELETE"])
def revoke_invite(invite_id):
    err = manager_required()
    if err:
        return err
    uid = current_uid()
    with get_db() as db:
        company_id = _user_company_id(db, uid)
        # company_id = NULL never matches, so a companyless manager (and any
        # cross-company id probe) gets the same uniform 404.
        row = db.execute(
            "UPDATE company_invites SET status = 'revoked' WHERE id = ? AND company_id = ? AND status = 'pending' RETURNING id",
            (invite_id, company_id),
        ).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True})


# ── Invites (employee side) ───────────────────────────────────────────────────

@bp.route("/api/onboarding/invites/lookup", methods=["GET"])
def lookup_invite():
    # PUBLIC route (listed in _PUBLIC_API_PATHS): lets the signup page preview
    # an invite before the account exists. Deliberately omits email, rate, ids.
    code = (request.args.get("code") or "").strip().upper()
    if not code:
        return jsonify({"error": "code required"}), 400
    with get_db() as db:
        row = db.execute(
            """SELECT ci.name, ci.job_role, c.name AS company_name
               FROM company_invites ci
               JOIN companies c ON c.id = ci.company_id
               WHERE ci.code = ? AND ci.status = 'pending'""",
            (code,),
        ).fetchone()
    if not row:
        # Uniform response for unknown/accepted/revoked codes.
        return jsonify({"valid": False, "error": "invalid or expired invite code"}), 404
    return jsonify({
        "valid": True,
        "company_name": row["company_name"],
        "name": row["name"],
        "job_role": row["job_role"],
    })


@bp.route("/api/onboarding/invites/accept", methods=["POST"])
def accept_invite():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    data = request.get_json() or {}
    code = data.get("code")
    if not isinstance(code, str) or not code.strip():
        return jsonify({"error": "code required"}), 400
    code = code.strip().upper()
    with get_db() as db:
        user = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
        if not user:
            return jsonify({"error": "not found"}), 404
        if user["company_id"] is not None:
            return jsonify({"error": "already in a company"}), 409
        # Atomic claim: the status filter makes a concurrent double-accept
        # match zero rows, which we surface as the uniform 404.
        invite = db.execute(
            """UPDATE company_invites
               SET status = 'accepted', claimed_by = ?, claimed_at = NOW()::text
               WHERE code = ? AND status = 'pending'
               RETURNING id, company_id, job_role, hourly_rate, manager_id""",
            (uid, code),
        ).fetchone()
        if not invite:
            return jsonify({"error": "invalid or expired invite code"}), 404
        manager = db.execute(
            "SELECT id, first_name, last_name FROM users WHERE id = ?", (invite["manager_id"],)
        ).fetchone()
        # Setting job_role/hourly_rate server-side is legitimate here despite
        # being manager-only fields: the values originate from a
        # manager-created invite, not the caller.
        manager_name = f"{manager['first_name']} {manager['last_name']}".strip() if manager else None
        if manager_name:
            db.execute(
                """UPDATE users SET company_id = ?, job_role = COALESCE(?, job_role),
                   hourly_rate = COALESCE(?, hourly_rate), manager_name = ? WHERE id = ?""",
                (invite["company_id"], invite["job_role"], invite["hourly_rate"], manager_name, uid),
            )
        else:
            db.execute(
                """UPDATE users SET company_id = ?, job_role = COALESCE(?, job_role),
                   hourly_rate = COALESCE(?, hourly_rate) WHERE id = ?""",
                (invite["company_id"], invite["job_role"], invite["hourly_rate"], uid),
            )
        company = db.execute(
            f"SELECT {_COMPANY_COLS} FROM companies WHERE id = ?", (invite["company_id"],)
        ).fetchone()
        updated = db.execute("SELECT job_role, hourly_rate FROM users WHERE id = ?", (uid,)).fetchone()
    return jsonify({
        "company": dict(company) if company else None,
        "manager": dict(manager) if manager else None,
        "job_role": updated["job_role"],
        "hourly_rate": updated["hourly_rate"],
    })


# ── Complete ──────────────────────────────────────────────────────────────────

@bp.route("/api/onboarding/complete", methods=["POST"])
def complete_onboarding():
    uid = current_uid()
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    data = request.get_json() or {}
    name_fields = {}
    for key in ("first_name", "last_name"):
        if key in data:
            val = data.get(key)
            if not isinstance(val, str) or not val.strip():
                return jsonify({"error": f"{key} must be a non-empty string"}), 400
            name_fields[key] = val.strip()
    with get_db() as db:
        user = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
        if not user:
            return jsonify({"error": "not found"}), 404
        if user["company_id"] is None:
            return jsonify({"error": "join a company first"}), 400
        if name_fields:
            set_clause = ", ".join(f"{k} = ?" for k in name_fields)
            db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", list(name_fields.values()) + [uid])
        row = db.execute(
            """UPDATE users SET onboarding_complete = TRUE WHERE id = ?
               RETURNING id, first_name, last_name, email, job_role, manager_name,
                         hourly_rate, is_manager, company_id""",
            (uid,),
        ).fetchone()
    return jsonify({"ok": True, "user": dict(row)})
