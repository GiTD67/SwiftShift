"""Real money movement via Stripe Connect ("separate charges and transfers").

Company funding source = a saved us_bank_account PaymentMethod collected through
a Stripe-hosted Checkout Session (mode=setup). Each employee = an Express
connected account onboarded via hosted Account Links. A payroll run = one ACH
debit PaymentIntent on the platform account; when it settles, one Transfer per
employee. Everything is plain REST against api.stripe.com using ``requests`` -
no Stripe SDK, no new dependencies.

Honesty constraint: when STRIPE_SECRET_KEY is unset, /api/payments/status
returns {"configured": false}, every other endpoint here returns 503 (except
the pure-math preview), and the webhook returns 400. Nothing ever fakes
success. This moves GROSS wages only - no tax withholding or remittance.

No raw bank numbers are ever stored: Stripe IDs, bank_name, last4 and statuses
only.
"""
import hashlib
import hmac
import json
import os
import time
from datetime import datetime

import requests
from flask import Blueprint, current_app, jsonify, request

from audit import log_event
from db import get_db
from permissions import current_uid, is_manager, manager_required
from routes.reports import (
    _OT_PREMIUM,
    _daily_hours,
    _load_users,
    _overtime_by_user,
    _user_name,
    _user_rate,
)

bp = Blueprint("payments", __name__)

_STRIPE_API_BASE = "https://api.stripe.com"

# Run statuses that mean a period has already been (or is being) paid, so a
# second run for the identical period is refused.
_ACTIVE_RUN_STATUSES = ("funding", "funded", "partially_paid", "paid")


def _ensure_tables():
    # Idempotent DDL run on every worker boot (same pattern as auth.py:19-81):
    # a failed statement aborts the whole Postgres transaction, so every
    # statement must be IF NOT EXISTS. Deliberately independent of any Stripe
    # configuration - the module must import cleanly with no env vars set.
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS payment_settings (
              id INTEGER PRIMARY KEY DEFAULT 1,
              company_id INTEGER,
              stripe_customer_id TEXT,
              funding_payment_method_id TEXT,
              funding_bank_name TEXT,
              funding_last4 TEXT,
              funding_status TEXT NOT NULL DEFAULT 'none',
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        # One funding row per company (company_id NULL = the legacy
        # pre-company deployment, mapped to 0 so it is unique too).
        db.execute("ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS company_id INTEGER")
        db.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS payment_settings_company_uniq
            ON payment_settings ((COALESCE(company_id, 0)))
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS employee_payout_accounts (
              user_id INTEGER PRIMARY KEY,
              stripe_account_id TEXT UNIQUE,
              onboarding_status TEXT NOT NULL DEFAULT 'not_started',
              payouts_enabled INTEGER NOT NULL DEFAULT 0,
              disabled_reason TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS payroll_runs (
              id SERIAL PRIMARY KEY,
              initiated_by INTEGER NOT NULL,
              company_id INTEGER,
              period_start TEXT NOT NULL,
              period_end TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'funding',
              total_gross_cents INTEGER NOT NULL DEFAULT 0,
              currency TEXT NOT NULL DEFAULT 'usd',
              stripe_payment_intent_id TEXT UNIQUE,
              failure_message TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.execute("ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS company_id INTEGER")
        # DB-level duplicate-period guard: at most one active run per company
        # and period, so two racing POST /api/payments/runs can't both debit
        # the bank (the SELECT-then-INSERT check alone is a TOCTOU race).
        db.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_active_period_uniq
            ON payroll_runs ((COALESCE(company_id, 0)), period_start, period_end)
            WHERE status IN ('funding', 'funded', 'partially_paid', 'paid')
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS payroll_run_items (
              id SERIAL PRIMARY KEY,
              run_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              hours REAL NOT NULL,
              overtime_hours REAL NOT NULL DEFAULT 0,
              hourly_rate REAL NOT NULL,
              gross_cents INTEGER NOT NULL,
              stripe_account_id TEXT,
              stripe_transfer_id TEXT,
              status TEXT NOT NULL DEFAULT 'pending',
              failure_message TEXT,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (run_id, user_id)
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS stripe_events (
              id SERIAL PRIMARY KEY,
              stripe_event_id TEXT UNIQUE NOT NULL,
              event_type TEXT NOT NULL,
              processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.commit()


_ensure_tables()


# --- Stripe REST helper (no SDK) -------------------------------------------

class StripeError(Exception):
    """A non-2xx response from Stripe (or Stripe unreachable)."""

    def __init__(self, message, code=None, status=None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


def _configured():
    return bool(os.environ.get("STRIPE_SECRET_KEY"))


def _app_base_url():
    return (os.environ.get("APP_BASE_URL") or "https://swiftshift.work").rstrip("/")


def _require_configured():
    """Return a 503 response when Stripe is not configured, else None."""
    if not _configured():
        return jsonify({"error": "payments not configured"}), 503
    return None


def _flatten_params(params, prefix=""):
    """Flatten nested dicts/lists into Stripe's bracket form-encoding,
    e.g. {"capabilities": {"transfers": {"requested": True}}} ->
    {"capabilities[transfers][requested]": "true"}."""
    flat = {}
    for key, value in params.items():
        full = f"{prefix}[{key}]" if prefix else str(key)
        if isinstance(value, dict):
            flat.update(_flatten_params(value, full))
        elif isinstance(value, (list, tuple)):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    flat.update(_flatten_params(item, f"{full}[{i}]"))
                else:
                    flat[f"{full}[{i}]"] = item
        elif isinstance(value, bool):
            flat[full] = "true" if value else "false"
        elif value is not None:
            flat[full] = value
    return flat


def _stripe(method, path, params=None, idempotency_key=None):
    """Call the Stripe REST API. Raises StripeError on any failure."""
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        raise StripeError("payments not configured", status=503)
    headers = {}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    flat = _flatten_params(params) if params else None
    kwargs = {"auth": (key, ""), "headers": headers, "timeout": 20}
    if method.upper() == "GET":
        kwargs["params"] = flat
    else:
        kwargs["data"] = flat
    try:
        resp = requests.request(method, _STRIPE_API_BASE + path, **kwargs)
    except requests.RequestException as exc:
        raise StripeError(f"could not reach Stripe: {exc}")
    if resp.status_code >= 400:
        try:
            err = resp.json().get("error", {})
            message = err.get("message") or f"Stripe error ({resp.status_code})"
            code = err.get("code")
        except ValueError:
            message, code = f"Stripe error ({resp.status_code})", None
        raise StripeError(message, code=code, status=resp.status_code)
    try:
        return resp.json()
    except ValueError:
        raise StripeError("invalid response from Stripe")


# --- payment_settings: one funding row per company ---------------------------

def _caller_company_id(db, uid):
    """The caller's own users.company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


def _get_payment_settings(db, company_id):
    """Return the company's payment_settings row as a dict, creating it with
    defaults on first use. company_id None = the legacy pre-company tenant."""
    row = db.execute(
        "SELECT * FROM payment_settings WHERE company_id IS NOT DISTINCT FROM ?",
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
            INSERT INTO payment_settings (id, company_id)
            VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM payment_settings), ?)
            ON CONFLICT DO NOTHING
            RETURNING *
            """,
            (company_id,),
        ).fetchone()
        db.commit()
        if not row:  # lost a race with a concurrent request
            row = db.execute(
                "SELECT * FROM payment_settings WHERE company_id IS NOT DISTINCT FROM ?",
                (company_id,),
            ).fetchone()
    return dict(row)


def _set_payment_settings(db, settings_id, **fields):
    sets = ", ".join(f"{col} = ?" for col in fields)
    db.execute(
        f"UPDATE payment_settings SET {sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        tuple(fields.values()) + (settings_id,),
    )
    db.commit()


def _settings_id_for_customer(db, customer_id):
    """The payment_settings row owning a Stripe customer (webhooks have no
    session, so the customer id is how we find the right company's row)."""
    if not customer_id:
        return None
    row = db.execute(
        "SELECT id FROM payment_settings WHERE stripe_customer_id = ?", (customer_id,)
    ).fetchone()
    return row["id"] if row else None


def _get_payout_account(db, uid):
    row = db.execute(
        "SELECT * FROM employee_payout_accounts WHERE user_id = ?", (uid,)
    ).fetchone()
    return dict(row) if row else None


# --- serialization helpers ---------------------------------------------------

def _ts(value):
    return str(value) if value is not None else None


def _serialize_run(row):
    return {
        "id": row["id"],
        "initiated_by": row["initiated_by"],
        "period_start": row["period_start"],
        "period_end": row["period_end"],
        "status": row["status"],
        "total_gross_cents": row["total_gross_cents"],
        "currency": row["currency"],
        "stripe_payment_intent_id": row["stripe_payment_intent_id"],
        "failure_message": row["failure_message"],
        "created_at": _ts(row["created_at"]),
        "updated_at": _ts(row["updated_at"]),
    }


def _serialize_item(row):
    out = {
        "id": row["id"],
        "run_id": row["run_id"],
        "user_id": row["user_id"],
        "hours": row["hours"],
        "overtime_hours": row["overtime_hours"],
        "hourly_rate": row["hourly_rate"],
        "gross_cents": row["gross_cents"],
        "stripe_account_id": row["stripe_account_id"],
        "stripe_transfer_id": row["stripe_transfer_id"],
        "status": row["status"],
        "failure_message": row["failure_message"],
        "updated_at": _ts(row["updated_at"]),
    }
    if "first_name" in row:
        out["name"] = (
            f"{row['first_name'] or ''} {row['last_name'] or ''}".strip()
            or f"User {row['user_id']}"
        )
    return out


def _load_run(db, run_id):
    row = db.execute("SELECT * FROM payroll_runs WHERE id = ?", (run_id,)).fetchone()
    return dict(row) if row else None


def _run_visible(db, run):
    """Company accounts only see their own company's runs; legacy
    (company_id NULL) callers keep the original global behavior."""
    caller_company = _caller_company_id(db, current_uid())
    return caller_company is None or run.get("company_id") == caller_company


def _load_run_items(db, run_id):
    return db.execute(
        """
        SELECT i.*, u.first_name, u.last_name
        FROM payroll_run_items i
        LEFT JOIN users u ON u.id = i.user_id
        WHERE i.run_id = ?
        ORDER BY i.id
        """,
        (run_id,),
    ).fetchall()


def _run_with_items(db, run_id):
    run = _load_run(db, run_id)
    if not run:
        return None
    out = _serialize_run(run)
    out["items"] = [_serialize_item(i) for i in _load_run_items(db, run_id)]
    return out


# --- GET /api/payments/status - any logged-in user --------------------------

@bp.route("/api/payments/status", methods=["GET"])
def payments_status():
    if not _configured():
        return jsonify({"configured": False})
    uid = current_uid()
    viewer_is_manager = is_manager(uid)
    with get_db() as db:
        out = {"configured": True}
        if viewer_is_manager:
            settings = _get_payment_settings(db, _caller_company_id(db, uid))
            out["company"] = {
                "funding_status": settings["funding_status"],
                "bank_name": settings["funding_bank_name"],
                "last4": settings["funding_last4"],
            }
        acct = _get_payout_account(db, uid)
        out["me"] = {
            "onboarding_status": acct["onboarding_status"] if acct else "not_started",
            "payouts_enabled": bool(acct["payouts_enabled"]) if acct else False,
            "disabled_reason": acct["disabled_reason"] if acct else None,
        }
    return jsonify(out)


# --- Company funding source (manager) ----------------------------------------

# POST /api/payments/company/funding-session - Stripe-hosted Checkout (mode=setup)
@bp.route("/api/payments/company/funding-session", methods=["POST"])
def company_funding_session():
    err = manager_required()
    if err:
        return err
    nc = _require_configured()
    if nc:
        return nc
    base = _app_base_url()
    try:
        with get_db() as db:
            settings = _get_payment_settings(db, _caller_company_id(db, current_uid()))
        customer_id = settings["stripe_customer_id"]
        if not customer_id:
            customer = _stripe("POST", "/v1/customers", {"name": "SwiftShift payroll funding"})
            customer_id = customer["id"]
            with get_db() as db:
                _set_payment_settings(db, settings["id"], stripe_customer_id=customer_id)
        checkout = _stripe(
            "POST",
            "/v1/checkout/sessions",
            {
                "mode": "setup",
                "customer": customer_id,
                "payment_method_types": ["us_bank_account"],
                "payment_method_options": {
                    "us_bank_account": {
                        "financial_connections": {"permissions": ["payment_method"]}
                    }
                },
                "success_url": f"{base}/?funding=success",
                "cancel_url": f"{base}/?funding=cancel",
            },
        )
    except StripeError as exc:
        return jsonify({"error": exc.message}), 502
    with get_db() as db:
        _set_payment_settings(db, settings["id"], funding_status="pending")
    return jsonify({"url": checkout["url"]})


def _store_verified_funding_pm(pm):
    """Persist a verified us_bank_account PaymentMethod (display metadata only)
    on the settings row that owns the PaymentMethod's customer."""
    bank = pm.get("us_bank_account") or {}
    customer_ref = pm.get("customer")
    customer_id = customer_ref if isinstance(customer_ref, str) else (customer_ref or {}).get("id")
    with get_db() as db:
        settings_id = _settings_id_for_customer(db, customer_id)
        if settings_id is None:
            return  # not one of our funding customers - nothing to attach to
        _set_payment_settings(
            db,
            settings_id,
            funding_payment_method_id=pm["id"],
            funding_bank_name=bank.get("bank_name"),
            funding_last4=bank.get("last4"),
            funding_status="verified",
        )


# GET /api/payments/company/funding
@bp.route("/api/payments/company/funding", methods=["GET"])
def company_funding():
    err = manager_required()
    if err:
        return err
    nc = _require_configured()
    if nc:
        return nc
    with get_db() as db:
        company_id = _caller_company_id(db, current_uid())
        settings = _get_payment_settings(db, company_id)
    if settings["funding_status"] == "pending" and settings["stripe_customer_id"]:
        # Self-heal missed webhooks: a saved us_bank_account PM on the customer
        # means setup completed and verified.
        try:
            pms = _stripe(
                "GET",
                f"/v1/customers/{settings['stripe_customer_id']}/payment_methods",
                {"type": "us_bank_account"},
            )
            data = pms.get("data") or []
            if data:
                _store_verified_funding_pm(data[0])
                with get_db() as db:
                    settings = _get_payment_settings(db, company_id)
        except StripeError:
            pass  # best-effort; stay pending
    return jsonify({
        "funding_status": settings["funding_status"],
        "bank_name": settings["funding_bank_name"],
        "last4": settings["funding_last4"],
    })


# DELETE /api/payments/company/funding
@bp.route("/api/payments/company/funding", methods=["DELETE"])
def company_funding_delete():
    err = manager_required()
    if err:
        return err
    nc = _require_configured()
    if nc:
        return nc
    with get_db() as db:
        settings = _get_payment_settings(db, _caller_company_id(db, current_uid()))
    if settings["funding_payment_method_id"]:
        try:
            _stripe("POST", f"/v1/payment_methods/{settings['funding_payment_method_id']}/detach")
        except StripeError as exc:
            return jsonify({"error": exc.message}), 502
    with get_db() as db:
        _set_payment_settings(
            db,
            settings["id"],
            funding_payment_method_id=None,
            funding_bank_name=None,
            funding_last4=None,
            funding_status="none",
        )
    return jsonify({"ok": True})


# --- Employee payout accounts (self) -----------------------------------------

# POST /api/payments/me/payout-account/onboard
@bp.route("/api/payments/me/payout-account/onboard", methods=["POST"])
def payout_account_onboard():
    nc = _require_configured()
    if nc:
        return nc
    uid = current_uid()
    with get_db() as db:
        acct = _get_payout_account(db, uid)
        user = db.execute("SELECT email FROM users WHERE id = ?", (uid,)).fetchone()
    account_id = acct["stripe_account_id"] if acct else None
    base = _app_base_url()
    try:
        if not account_id:
            created = _stripe(
                "POST",
                "/v1/accounts",
                {
                    "type": "express",
                    "country": "US",
                    "email": user["email"] if user else None,
                    "capabilities": {"transfers": {"requested": True}},
                    "business_type": "individual",
                    "metadata": {"swiftshift_user_id": uid},
                },
                idempotency_key=f"acct-user-{uid}",
            )
            account_id = created["id"]
            with get_db() as db:
                db.execute(
                    """
                    INSERT INTO employee_payout_accounts (user_id, stripe_account_id, onboarding_status)
                    VALUES (?, ?, 'pending')
                    ON CONFLICT (user_id) DO UPDATE SET
                      stripe_account_id = EXCLUDED.stripe_account_id,
                      onboarding_status = 'pending',
                      updated_at = CURRENT_TIMESTAMP
                    RETURNING user_id
                    """,
                    (uid, account_id),
                )
                db.commit()
        # Account Links are single-use, so always mint a fresh one.
        link = _stripe(
            "POST",
            "/v1/account_links",
            {
                "account": account_id,
                "type": "account_onboarding",
                "refresh_url": f"{base}/?payouts=refresh",
                "return_url": f"{base}/?payouts=return",
            },
        )
    except StripeError as exc:
        return jsonify({"error": exc.message}), 502
    return jsonify({"url": link["url"]})


# GET /api/payments/me/payout-account
@bp.route("/api/payments/me/payout-account", methods=["GET"])
def payout_account_get():
    nc = _require_configured()
    if nc:
        return nc
    uid = current_uid()
    with get_db() as db:
        acct = _get_payout_account(db, uid)
    if acct and acct["stripe_account_id"] and acct["onboarding_status"] != "complete":
        # Refresh from Stripe to self-heal missed account.updated webhooks.
        try:
            remote = _stripe("GET", f"/v1/accounts/{acct['stripe_account_id']}")
            status = "complete" if remote.get("details_submitted") else acct["onboarding_status"]
            with get_db() as db:
                db.execute(
                    """
                    UPDATE employee_payout_accounts
                    SET onboarding_status = ?, payouts_enabled = ?, disabled_reason = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                    """,
                    (
                        status,
                        1 if remote.get("payouts_enabled") else 0,
                        (remote.get("requirements") or {}).get("disabled_reason"),
                        uid,
                    ),
                )
                db.commit()
                acct = _get_payout_account(db, uid)
        except StripeError:
            pass  # best-effort; show what we have
    return jsonify({
        "onboarding_status": acct["onboarding_status"] if acct else "not_started",
        "payouts_enabled": bool(acct["payouts_enabled"]) if acct else False,
        "disabled_reason": acct["disabled_reason"] if acct else None,
        "has_account": bool(acct and acct["stripe_account_id"]),
    })


# POST /api/payments/me/payout-account/login-link - Express Dashboard access
@bp.route("/api/payments/me/payout-account/login-link", methods=["POST"])
def payout_account_login_link():
    nc = _require_configured()
    if nc:
        return nc
    uid = current_uid()
    with get_db() as db:
        acct = _get_payout_account(db, uid)
    if not acct or not acct["stripe_account_id"] or acct["onboarding_status"] != "complete":
        return jsonify({"error": "payout account not set up"}), 409
    try:
        link = _stripe("POST", f"/v1/accounts/{acct['stripe_account_id']}/login_links")
    except StripeError as exc:
        return jsonify({"error": exc.message}), 502
    return jsonify({"url": link["url"]})


# GET /api/payments/me/payouts - my payroll-run items, newest first
@bp.route("/api/payments/me/payouts", methods=["GET"])
def my_payouts():
    nc = _require_configured()
    if nc:
        return nc
    uid = current_uid()
    with get_db() as db:
        rows = db.execute(
            """
            SELECT i.run_id, r.period_start, r.period_end, r.status AS run_status,
                   i.hours, i.overtime_hours,
                   i.hourly_rate, i.gross_cents, i.status, i.updated_at
            FROM payroll_run_items i
            JOIN payroll_runs r ON r.id = i.run_id
            WHERE i.user_id = ?
            ORDER BY r.created_at DESC, i.run_id DESC
            """,
            (uid,),
        ).fetchall()
    return jsonify({
        "items": [
            {
                "run_id": r["run_id"],
                "period_start": r["period_start"],
                "period_end": r["period_end"],
                "hours": r["hours"],
                "overtime_hours": r["overtime_hours"],
                "hourly_rate": r["hourly_rate"],
                "gross_cents": r["gross_cents"],
                "status": r["status"],
                "run_status": r["run_status"],
                "updated_at": _ts(r["updated_at"]),
            }
            for r in rows
        ]
    })


# --- Payroll runs (manager) ---------------------------------------------------

def _parse_period(data):
    """Validate {"period_start", "period_end"} as YYYY-MM-DD; (None, None) if bad."""
    start = str(data.get("period_start") or "").strip()
    end = str(data.get("period_end") or "").strip()
    try:
        datetime.strptime(start, "%Y-%m-%d")
        datetime.strptime(end, "%Y-%m-%d")
    except ValueError:
        return None, None
    if end < start:
        return None, None
    return start, end


def _compute_items(db, start, end, company_id):
    """Per-user gross for the period, reusing reports.py hour/overtime math
    (single source of truth - do not fork). Scoped to the given company's
    employees; company_id None (legacy pre-company callers) keeps the
    original global behavior, mirroring users.py."""
    daily = _daily_hours(db, start, end)
    users = _load_users(db)
    if company_id is not None:
        company_uids = {
            r["id"]
            for r in db.execute(
                "SELECT id FROM users WHERE company_id = ?", (company_id,)
            ).fetchall()
        }
        daily = {k: v for k, v in daily.items() if k[0] in company_uids}
    ot_by_user = _overtime_by_user(daily)
    hours_by_user = {}
    for (uid, _), hrs in daily.items():
        hours_by_user[uid] = hours_by_user.get(uid, 0.0) + hrs
    payout_rows = db.execute(
        "SELECT user_id, stripe_account_id, onboarding_status, payouts_enabled FROM employee_payout_accounts"
    ).fetchall()
    payout_accounts = {r["user_id"]: r for r in payout_rows}

    items = []
    for uid in sorted(hours_by_user):
        hrs = hours_by_user[uid]
        ot = ot_by_user.get(uid, 0.0)
        rate = _user_rate(users, uid)
        gross_cents = round((hrs * rate + ot * rate * _OT_PREMIUM) * 100)
        acct = payout_accounts.get(uid)
        ready = bool(
            acct
            and acct["stripe_account_id"]
            and acct["onboarding_status"] == "complete"
            and acct["payouts_enabled"]
        )
        if gross_cents <= 0:
            skip_reason = "zero_amount"
        elif not ready:
            skip_reason = "no_payout_account"
        else:
            skip_reason = None
        items.append({
            "user_id": uid,
            "name": _user_name(users, uid),
            "hours": round(hrs, 2),
            "overtime_hours": round(ot, 2),
            "hourly_rate": rate,
            "gross_cents": gross_cents,
            "stripe_account_id": acct["stripe_account_id"] if acct else None,
            "payout_ready": ready,
            "skip_reason": skip_reason,
        })
    return items


# POST /api/payments/runs/preview - pure computation, persists nothing.
# Deliberately works even when Stripe is unconfigured: it's just math.
@bp.route("/api/payments/runs/preview", methods=["POST"])
def preview_run():
    err = manager_required()
    if err:
        return err
    data = request.get_json() or {}
    start, end = _parse_period(data)
    if not start:
        return jsonify({"error": "period_start and period_end must be YYYY-MM-DD"}), 400
    with get_db() as db:
        items = _compute_items(db, start, end, _caller_company_id(db, current_uid()))
    payable = [i for i in items if i["skip_reason"] is None]
    return jsonify({
        "period_start": start,
        "period_end": end,
        "total_payable_cents": sum(i["gross_cents"] for i in payable),
        "items": [
            {k: v for k, v in i.items() if k != "stripe_account_id"} for i in items
        ],
    })


# POST /api/payments/runs - create a run and confirm the funding ACH debit
@bp.route("/api/payments/runs", methods=["POST"])
def create_run():
    err = manager_required()
    if err:
        return err
    nc = _require_configured()
    if nc:
        return nc
    data = request.get_json() or {}
    start, end = _parse_period(data)
    if not start:
        return jsonify({"error": "period_start and period_end must be YYYY-MM-DD"}), 400
    uid = current_uid()

    with get_db() as db:
        caller_company = _caller_company_id(db, uid)
        settings = _get_payment_settings(db, caller_company)
        if (
            settings["funding_status"] != "verified"
            or not settings["stripe_customer_id"]
            or not settings["funding_payment_method_id"]
        ):
            return jsonify({"error": "company bank not connected"}), 409
        existing = db.execute(
            "SELECT id FROM payroll_runs WHERE period_start = ? AND period_end = ?"
            " AND company_id IS NOT DISTINCT FROM ? AND status IN (?, ?, ?, ?)",
            (start, end, caller_company) + _ACTIVE_RUN_STATUSES,
        ).fetchone()
        if existing:
            return jsonify({"error": "payroll already run for this period"}), 409

        items = _compute_items(db, start, end, caller_company)
        payable = [i for i in items if i["skip_reason"] is None]
        if not payable:
            return jsonify({"error": "no payable employees in this period"}), 400
        total = sum(i["gross_cents"] for i in payable)

        # The partial unique index payroll_runs_active_period_uniq backstops
        # the SELECT above: a racing duplicate INSERT fails instead of
        # double-debiting the bank. Savepoint because a failed INSERT aborts
        # the surrounding Postgres transaction.
        db.execute("SAVEPOINT run_insert")
        try:
            run_row = db.execute(
                """
                INSERT INTO payroll_runs (initiated_by, company_id, period_start, period_end, status, total_gross_cents)
                VALUES (?, ?, ?, ?, 'funding', ?)
                RETURNING id
                """,
                (uid, caller_company, start, end, total),
            ).fetchone()
            db.execute("RELEASE SAVEPOINT run_insert")
        except Exception as exc:
            if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
                db.execute("ROLLBACK TO SAVEPOINT run_insert")
                return jsonify({"error": "payroll already run for this period"}), 409
            raise
        run_id = run_row["id"]
        for item in items:
            if item["skip_reason"] == "zero_amount":
                status, failure = "failed", "zero_amount"
            elif item["skip_reason"] == "no_payout_account":
                status, failure = "skipped_no_payout_account", None
            else:
                status, failure = "pending", None
            db.execute(
                """
                INSERT INTO payroll_run_items
                  (run_id, user_id, hours, overtime_hours, hourly_rate, gross_cents,
                   stripe_account_id, status, failure_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    item["user_id"],
                    item["hours"],
                    item["overtime_hours"],
                    item["hourly_rate"],
                    item["gross_cents"],
                    item["stripe_account_id"],
                    status,
                    failure,
                ),
            )
        db.commit()

    # Debit the company bank for the gross total (settles in ~4 business days).
    try:
        pi = _stripe(
            "POST",
            "/v1/payment_intents",
            {
                "amount": total,
                "currency": "usd",
                "customer": settings["stripe_customer_id"],
                "payment_method": settings["funding_payment_method_id"],
                "payment_method_types": ["us_bank_account"],
                "confirm": True,
                "off_session": True,
                "metadata": {"payroll_run_id": run_id},
            },
            idempotency_key=f"run-{run_id}-pi",
        )
    except StripeError as exc:
        with get_db() as db:
            db.execute(
                "UPDATE payroll_runs SET status = 'failed', failure_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (exc.message, run_id),
            )
            db.commit()
        log_event(uid, None, "payroll_run_failed",
                  f"Payroll run #{run_id} ({start} to {end}) could not start ACH debit: {exc.message}")
        return jsonify({"error": exc.message}), 502

    with get_db() as db:
        db.execute(
            "UPDATE payroll_runs SET stripe_payment_intent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (pi["id"], run_id),
        )
        db.commit()
        run = _run_with_items(db, run_id)
    log_event(uid, None, "payroll_run_created",
              f"Payroll run #{run_id} for {start} to {end}: ${total / 100:.2f} gross to {len(payable)} employees (ACH debit started)")
    return jsonify({"run": run}), 201


# GET /api/payments/runs - newest first with item counts
@bp.route("/api/payments/runs", methods=["GET"])
def list_runs():
    err = manager_required()
    if err:
        return err
    nc = _require_configured()
    if nc:
        return nc
    with get_db() as db:
        caller_company = _caller_company_id(db, current_uid())
        company_filter = "" if caller_company is None else "WHERE r.company_id = ?"
        rows = db.execute(
            f"""
            SELECT r.*,
                   COUNT(i.id) AS item_count,
                   COALESCE(SUM(CASE WHEN i.status = 'sent' THEN 1 ELSE 0 END), 0) AS sent_count,
                   COALESCE(SUM(CASE WHEN i.status = 'skipped_no_payout_account' THEN 1 ELSE 0 END), 0) AS skipped_count
            FROM payroll_runs r
            LEFT JOIN payroll_run_items i ON i.run_id = r.id
            {company_filter}
            GROUP BY r.id
            ORDER BY r.created_at DESC, r.id DESC
            """,
            () if caller_company is None else (caller_company,),
        ).fetchall()
    runs = []
    for r in rows:
        run = _serialize_run(r)
        run["item_count"] = int(r["item_count"] or 0)
        run["sent_count"] = int(r["sent_count"] or 0)
        run["skipped_count"] = int(r["skipped_count"] or 0)
        runs.append(run)
    return jsonify({"runs": runs})


# GET /api/payments/runs/<id> - run detail with per-employee items
@bp.route("/api/payments/runs/<int:run_id>", methods=["GET"])
def run_detail(run_id):
    err = manager_required()
    if err:
        return err
    nc = _require_configured()
    if nc:
        return nc
    with get_db() as db:
        run = _load_run(db, run_id)
        if not run or not _run_visible(db, run):
            return jsonify({"error": "not found"}), 404
        items = [_serialize_item(i) for i in _load_run_items(db, run_id)]
    return jsonify({"run": _serialize_run(run), "items": items})


# POST /api/payments/runs/<id>/cancel - only while the ACH debit hasn't started
@bp.route("/api/payments/runs/<int:run_id>/cancel", methods=["POST"])
def cancel_run(run_id):
    err = manager_required()
    if err:
        return err
    nc = _require_configured()
    if nc:
        return nc
    with get_db() as db:
        run = _load_run(db, run_id)
        if run and not _run_visible(db, run):
            run = None
    if not run:
        return jsonify({"error": "not found"}), 404
    if run["status"] != "funding":
        return jsonify({"error": "only runs awaiting funding can be canceled"}), 409
    if run["stripe_payment_intent_id"]:
        try:
            _stripe("POST", f"/v1/payment_intents/{run['stripe_payment_intent_id']}/cancel")
        except StripeError as exc:
            # An ACH debit already processing can't be canceled - be honest.
            return jsonify({"error": exc.message}), 409
    with get_db() as db:
        db.execute(
            "UPDATE payroll_runs SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (run_id,),
        )
        db.commit()
        payload = _run_with_items(db, run_id)
    log_event(current_uid(), None, "payroll_run_canceled", f"Payroll run #{run_id} canceled")
    return jsonify({"run": payload})


# POST /api/payments/runs/<id>/sync - missed-webhook recovery
@bp.route("/api/payments/runs/<int:run_id>/sync", methods=["POST"])
def sync_run(run_id):
    err = manager_required()
    if err:
        return err
    nc = _require_configured()
    if nc:
        return nc
    with get_db() as db:
        run = _load_run(db, run_id)
        if run and not _run_visible(db, run):
            run = None
    if not run:
        return jsonify({"error": "not found"}), 404
    if run["stripe_payment_intent_id"]:
        try:
            pi = _stripe("GET", f"/v1/payment_intents/{run['stripe_payment_intent_id']}")
        except StripeError as exc:
            return jsonify({"error": exc.message}), 502
        _apply_payment_intent_state(run, pi)
    with get_db() as db:
        payload = _run_with_items(db, run_id)
    return jsonify({"run": payload})


# --- Run state machine (shared by webhook + sync) -----------------------------

def _find_run_for_pi(pi):
    """Locate a run by PaymentIntent metadata.payroll_run_id, else by pi id."""
    run_id = (pi.get("metadata") or {}).get("payroll_run_id")
    with get_db() as db:
        row = None
        if run_id:
            try:
                row = db.execute(
                    "SELECT * FROM payroll_runs WHERE id = ?", (int(run_id),)
                ).fetchone()
            except (TypeError, ValueError):
                row = None
        if not row and pi.get("id"):
            row = db.execute(
                "SELECT * FROM payroll_runs WHERE stripe_payment_intent_id = ?",
                (pi["id"],),
            ).fetchone()
    return dict(row) if row else None


def _execute_transfers(run_id):
    """Send one Transfer per pending item, then settle the run's final status.
    Previously-failed items (except synthetic zero_amount rows) are retried
    too, so POST /runs/<id>/sync can recover a transient Stripe failure - the
    per-item Idempotency-Key makes re-execution exactly-once at Stripe (a
    send-then-timeout retry returns the original transfer instead of paying
    twice)."""
    with get_db() as db:
        to_send = db.execute(
            """
            SELECT * FROM payroll_run_items
            WHERE run_id = ?
              AND (status = 'pending'
                   OR (status = 'failed' AND COALESCE(failure_message, '') != 'zero_amount'))
            ORDER BY id
            """,
            (run_id,),
        ).fetchall()
    for item in to_send:
        try:
            transfer = _stripe(
                "POST",
                "/v1/transfers",
                {
                    "amount": item["gross_cents"],
                    "currency": "usd",
                    "destination": item["stripe_account_id"],
                    "transfer_group": f"payroll_run_{run_id}",
                    "metadata": {"run_id": run_id, "user_id": item["user_id"]},
                },
                idempotency_key=f"run-{run_id}-item-{item['id']}",
            )
            with get_db() as db:
                db.execute(
                    "UPDATE payroll_run_items SET status = 'sent', stripe_transfer_id = ?, failure_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (transfer["id"], item["id"]),
                )
                db.commit()
        except StripeError as exc:
            with get_db() as db:
                db.execute(
                    "UPDATE payroll_run_items SET status = 'failed', failure_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (exc.message, item["id"]),
                )
                db.commit()

    # Final run status over payable items (skipped / zero-amount don't count).
    with get_db() as db:
        rows = db.execute(
            "SELECT status, failure_message FROM payroll_run_items WHERE run_id = ?",
            (run_id,),
        ).fetchall()
        payable = [
            r for r in rows
            if r["status"] != "skipped_no_payout_account"
            and not (r["status"] == "failed" and r["failure_message"] == "zero_amount")
        ]
        sent = sum(1 for r in payable if r["status"] == "sent")
        if payable and sent == len(payable):
            final = "paid"
        elif sent > 0:
            final = "partially_paid"
        else:
            final = "failed"
        changed = db.execute(
            "UPDATE payroll_runs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != ? RETURNING id",
            (final, run_id, final),
        ).fetchone()
        db.commit()
    # Only audit an actual transition (a Sync of an already-settled run is a
    # no-op), and name the action after the real outcome.
    if changed:
        action = {
            "paid": "payroll_run_paid",
            "partially_paid": "payroll_run_partially_paid",
        }.get(final, "payroll_run_failed")
        log_event(None, "Stripe", action,
                  f"Payroll run #{run_id}: {sent} of {len(payable)} transfers sent (status: {final})")


def _handle_run_funded(run):
    """ACH debit settled: mark funded, then transfer to each employee."""
    if run["status"] == "canceled":
        return
    with get_db() as db:
        db.execute(
            "UPDATE payroll_runs SET status = 'funded', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'funding'",
            (run["id"],),
        )
        db.commit()
    _execute_transfers(run["id"])


def _handle_payment_failed(run, pi):
    message = ((pi.get("last_payment_error") or {}).get("message")) or "ACH debit failed"
    with get_db() as db:
        db.execute(
            "UPDATE payroll_runs SET status = 'failed', failure_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (message, run["id"]),
        )
        db.commit()
    log_event(None, "Stripe", "payroll_run_failed",
              f"Payroll run #{run['id']} ACH debit failed: {message}")


def _apply_payment_intent_state(run, pi):
    """Map a PaymentIntent's status onto the run - same machine as the webhook."""
    status = pi.get("status")
    if status == "succeeded":
        _handle_run_funded(run)
    elif status == "canceled":
        with get_db() as db:
            db.execute(
                "UPDATE payroll_runs SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'funding'",
                (run["id"],),
            )
            db.commit()
    elif status == "requires_payment_method":
        # A confirmed ACH PI lands here after the debit fails.
        _handle_payment_failed(run, pi)
    # processing / requires_action / requires_confirmation → run stays 'funding'


# --- Webhook ------------------------------------------------------------------

def _verify_webhook_signature(raw_body, sig_header):
    """Stdlib-only Stripe signature check: signed_payload = f"{t}.{raw_body}",
    HMAC-SHA256 hex with the whsec_ secret, 5-minute tolerance. Tries the
    account-events secret then the connected-accounts secret."""
    secrets = [
        s for s in (
            os.environ.get("STRIPE_WEBHOOK_SECRET"),
            os.environ.get("STRIPE_CONNECT_WEBHOOK_SECRET"),
        ) if s
    ]
    if not secrets or not sig_header:
        return False
    timestamp = None
    v1_signatures = []
    for part in sig_header.split(","):
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        k, v = k.strip(), v.strip()
        if k == "t":
            timestamp = v
        elif k == "v1":
            v1_signatures.append(v)
    if not timestamp or not v1_signatures:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(time.time() - ts) > 300:
        return False
    for secret in secrets:
        expected = hmac.new(
            secret.encode("utf-8"),
            f"{timestamp}.".encode("utf-8") + raw_body,
            hashlib.sha256,
        ).hexdigest()
        for sig in v1_signatures:
            if hmac.compare_digest(expected, sig):
                return True
    return False


def _customer_id_of(obj):
    """The customer id of a Stripe object (expanded or not)."""
    ref = (obj or {}).get("customer")
    return ref if isinstance(ref, str) else (ref or {}).get("id")


def _apply_setup_intent(si):
    """SetupIntent outcome → funding fields on the owning company's settings
    row (located via the Stripe customer). si may be partial (id only)."""
    if si.get("status") != "succeeded" or not si.get("payment_method"):
        with get_db() as db:
            settings_id = _settings_id_for_customer(db, _customer_id_of(si))
            if settings_id is not None:
                _set_payment_settings(db, settings_id, funding_status="pending")
        return
    pm_ref = si["payment_method"]
    pm_id = pm_ref if isinstance(pm_ref, str) else pm_ref.get("id")
    pm = _stripe("GET", f"/v1/payment_methods/{pm_id}")
    _store_verified_funding_pm(pm)


def _handle_event(event_type, event):
    obj = ((event.get("data") or {}).get("object")) or {}

    if event_type == "checkout.session.completed":
        if obj.get("mode") == "setup" and obj.get("setup_intent"):
            si = _stripe("GET", f"/v1/setup_intents/{obj['setup_intent']}")
            _apply_setup_intent(si)

    elif event_type == "setup_intent.succeeded":
        _apply_setup_intent(obj)

    elif event_type == "setup_intent.setup_failed":
        with get_db() as db:
            settings_id = _settings_id_for_customer(db, _customer_id_of(obj))
            if settings_id is not None:
                _set_payment_settings(db, settings_id, funding_status="failed")

    elif event_type == "payment_intent.processing":
        pass  # ACH debit in flight; run stays 'funding'

    elif event_type == "payment_intent.succeeded":
        run = _find_run_for_pi(obj)
        if run:
            _handle_run_funded(run)

    elif event_type == "payment_intent.payment_failed":
        run = _find_run_for_pi(obj)
        if run:
            _handle_payment_failed(run, obj)

    elif event_type == "account.updated":
        account_id = obj.get("id")
        if account_id:
            with get_db() as db:
                row = db.execute(
                    "SELECT user_id, onboarding_status FROM employee_payout_accounts WHERE stripe_account_id = ?",
                    (account_id,),
                ).fetchone()
                if row:
                    status = "complete" if obj.get("details_submitted") else row["onboarding_status"]
                    db.execute(
                        """
                        UPDATE employee_payout_accounts
                        SET payouts_enabled = ?, onboarding_status = ?, disabled_reason = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE stripe_account_id = ?
                        """,
                        (
                            1 if obj.get("payouts_enabled") else 0,
                            status,
                            (obj.get("requirements") or {}).get("disabled_reason"),
                            account_id,
                        ),
                    )
                    db.commit()

    elif event_type == "charge.dispute.created":
        pi_id = obj.get("payment_intent")
        if not pi_id and obj.get("charge"):
            try:
                charge = _stripe("GET", f"/v1/charges/{obj['charge']}")
                pi_id = charge.get("payment_intent")
            except StripeError:
                pi_id = None
        if pi_id:
            with get_db() as db:
                row = db.execute(
                    "SELECT id, failure_message FROM payroll_runs WHERE stripe_payment_intent_id = ?",
                    (pi_id,),
                ).fetchone()
                if row and "ACH dispute opened" not in (row["failure_message"] or ""):
                    existing = row["failure_message"]
                    message = f"{existing}; ACH dispute opened" if existing else "ACH dispute opened"
                    db.execute(
                        "UPDATE payroll_runs SET failure_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (message, row["id"]),
                    )
                    db.commit()
    # anything else: ignore


# POST /api/stripe/webhook - public (listed in app.py _PUBLIC_API_PATHS);
# authenticity comes from the signature, never from a session.
@bp.route("/api/stripe/webhook", methods=["POST"])
def stripe_webhook():
    if not _configured():
        return jsonify({"error": "payments not configured"}), 400
    raw_body = request.get_data()  # raw bytes, unmodified - required for HMAC
    if not _verify_webhook_signature(raw_body, request.headers.get("Stripe-Signature", "")):
        return jsonify({"error": "invalid signature"}), 400
    try:
        event = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return jsonify({"error": "invalid payload"}), 400
    event_id = event.get("id")
    event_type = event.get("type") or ""
    if event_id:
        try:
            with get_db() as db:
                db.execute(
                    "INSERT INTO stripe_events (stripe_event_id, event_type) VALUES (?, ?)",
                    (event_id, event_type),
                )
                db.commit()
        except Exception as exc:
            if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
                return jsonify({"received": True})  # already processed
            raise
    try:
        _handle_event(event_type, event)
    except Exception:
        current_app.logger.exception("stripe webhook handler failed (%s)", event_type)
        # Forget the dedup row so Stripe's retry actually re-runs the handler.
        if event_id:
            try:
                with get_db() as db:
                    db.execute("DELETE FROM stripe_events WHERE stripe_event_id = ?", (event_id,))
                    db.commit()
            except Exception:
                pass
        return jsonify({"error": "event handling failed"}), 500
    return jsonify({"received": True})
