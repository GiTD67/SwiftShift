"""SaaS subscription billing: a 30-day Pro free trial plus Stripe Checkout
(card or US bank ACH) for charging companies to use SwiftShift.

This is separate from routes/payments.py, which moves payroll money OUT to
employees. Billing reuses the same Stripe account and secret key
(STRIPE_SECRET_KEY) but its own recurring price (STRIPE_PRICE_PRO) and its own
webhook signing secret (STRIPE_BILLING_WEBHOOK_SECRET).

Trial / plan state lives on the companies table (per-workspace). Companies that
existed before billing shipped are grandfathered to unlimited Pro in
onboarding._ensure_tables, so nothing breaks for current customers; only
companies created after a trial timestamp is recorded go through trial -> paywall.

Honesty constraint mirrors payments.py: with STRIPE_SECRET_KEY unset,
/api/billing/status reports configured:false, checkout/portal return 503, and the
webhook returns 400. Nothing ever fakes a subscription.
"""
import hashlib
import hmac
import json
import math
import os
import time
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request

from audit import log_event
from db import get_db
from permissions import current_uid, is_manager, manager_required
from routes.payments import StripeError, _stripe

bp = Blueprint("billing", __name__)

_TRIAL_DAYS = 30
_BILLING_COLS = (
    "id, name, plan, subscription_status, trial_started_at, trial_ends_at, "
    "billing_customer_id, billing_subscription_id"
)

# Stripe subscription.status -> our companies.subscription_status. A Stripe-side
# trial still counts as entitled (we model that as 'active' here, since our own
# trial window is tracked separately on the company row).
_STRIPE_STATUS_MAP = {
    "active": "active",
    "trialing": "active",
    "past_due": "past_due",
    "unpaid": "past_due",
    "incomplete": "past_due",
    "paused": "past_due",
    "canceled": "canceled",
    "incomplete_expired": "canceled",
}


# --- config / time helpers ---------------------------------------------------

def _configured():
    return bool(os.environ.get("STRIPE_SECRET_KEY"))


def _price_id():
    return os.environ.get("STRIPE_PRICE_PRO")


def _app_base_url():
    return (os.environ.get("APP_BASE_URL") or "https://swiftshift.work").rstrip("/")


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_ts(value):
    """Parse a naive-UTC timestamp string written by NOW()::text (e.g.
    '2026-06-25 12:34:56.789+00'). Returns a naive datetime or None."""
    if not value:
        return None
    s = str(value).strip()
    # Drop any timezone offset/zone marker after the date part; treat as UTC.
    for marker in ("+", "Z"):
        idx = s.find(marker, 10)
        if idx != -1:
            s = s[:idx]
            break
    s = s.replace(" ", "T", 1).strip()
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        try:
            return datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")
        except ValueError:
            return None


# --- company billing row -----------------------------------------------------

def _caller_company_id(db, uid):
    """The caller's own users.company_id (NULL for legacy pre-company accounts)."""
    if not uid:
        return None
    row = db.execute("SELECT company_id FROM users WHERE id = ?", (uid,)).fetchone()
    return row["company_id"] if row else None


def _company_row(db, company_id):
    if company_id is None:
        return None
    row = db.execute(
        f"SELECT {_BILLING_COLS} FROM companies WHERE id = ?", (company_id,)
    ).fetchone()
    return dict(row) if row else None


def _seat_count(db, company_id):
    """Active employees in the company = the per-employee billing quantity."""
    if company_id is None:
        return 1
    row = db.execute(
        "SELECT COUNT(*) AS n FROM users WHERE company_id = ?", (company_id,)
    ).fetchone()
    return max(1, int((row["n"] if row else 0) or 0))


def _company_id_for_customer(db, customer_id):
    if not customer_id:
        return None
    row = db.execute(
        "SELECT id FROM companies WHERE billing_customer_id = ?", (customer_id,)
    ).fetchone()
    return row["id"] if row else None


def _entitlement(company):
    """Pro entitlement for a company billing row (None = no company / legacy).

    Legacy callers and grandfathered companies are always entitled; a trialing
    company is entitled until trial_ends_at; active is entitled; everything else
    (expired trial, past_due, canceled) is gated.
    """
    if company is None:
        return {
            "entitled": True,
            "status": "grandfathered",
            "plan": "pro",
            "trial_ends_at": None,
            "trial_days_left": None,
        }
    status = company.get("subscription_status") or "trialing"
    plan = company.get("plan") or "starter"
    trial_ends = _parse_ts(company.get("trial_ends_at"))
    days_left = None
    if trial_ends is not None:
        secs = (trial_ends - _now()).total_seconds()
        days_left = max(0, math.ceil(secs / 86400)) if secs > 0 else 0

    if status in ("grandfathered", "active"):
        entitled = True
    elif status == "trialing":
        entitled = trial_ends is None or _now() < trial_ends
    else:  # past_due, canceled, incomplete, starter
        entitled = False

    return {
        "entitled": entitled,
        "status": status,
        "plan": plan,
        "trial_ends_at": company.get("trial_ends_at"),
        "trial_days_left": days_left,
    }


def entitlement_for_uid(db, uid):
    """Pro entitlement for a user, by their company. Used by other modules
    (e.g. Swifty) to gate Pro-only features."""
    return _entitlement(_company_row(db, _caller_company_id(db, uid)))


def swifty_access(db, uid):
    """Whether the user may use Swifty (a Pro feature).

    The gate only engages once billing is fully configured (secret + price), so
    users are never trapped without a way to upgrade. While billing is not yet
    configured, Swifty stays open for everyone.
    """
    ent = entitlement_for_uid(db, uid)
    gating_on = bool(_configured() and _price_id())
    allowed = ent["entitled"] or not gating_on
    return {"allowed": allowed, **ent}


# --- endpoints ---------------------------------------------------------------

@bp.route("/api/billing/status", methods=["GET"])
def billing_status():
    """Current plan / trial state for the caller's company. Any logged-in user."""
    uid = current_uid()
    with get_db() as db:
        company_id = _caller_company_id(db, uid)
        company = _company_row(db, company_id)
        seats = _seat_count(db, company_id)
    ent = _entitlement(company)
    return jsonify({
        "configured": _configured(),
        "price_configured": bool(_price_id()),
        "is_manager": is_manager(uid),
        "has_company": company_id is not None,
        "company_name": company.get("name") if company else None,
        "seats": seats,
        **ent,
    })


@bp.route("/api/billing/start-trial", methods=["POST"])
def start_trial():
    """Begin a 30-day Pro trial for a company that has no active plan/trial yet.

    New companies already start a trial at creation, so for most callers this is
    a no-op that just returns current state. An already-expired trial cannot be
    restarted here (no trial farming) - those callers must subscribe.
    """
    err = manager_required()
    if err:
        return err
    uid = current_uid()
    with get_db() as db:
        company_id = _caller_company_id(db, uid)
        if company_id is None:
            return jsonify({"error": "no company"}), 404
        company = _company_row(db, company_id)
        if not company:
            return jsonify({"error": "company not found"}), 404
        # A company that has ever held a real subscription cannot drop back to a
        # fresh free trial (no trial farming); it must manage billing instead.
        if company.get("billing_subscription_id"):
            return jsonify({"error": "subscription exists; manage it in billing"}), 409
        if (company.get("subscription_status") or "") in ("grandfathered", "active", "trialing"):
            return jsonify(_entitlement(company))
        started = _now()
        ends = started + timedelta(days=_TRIAL_DAYS)
        db.execute(
            "UPDATE companies SET subscription_status = 'trialing', plan = 'starter', "
            "trial_started_at = ?, trial_ends_at = ? WHERE id = ?",
            (started.isoformat(sep=" "), ends.isoformat(sep=" "), company_id),
        )
        db.commit()
        company = _company_row(db, company_id)
    log_event(uid, None, "billing_trial_start", "Started 30-day Pro trial")
    return jsonify(_entitlement(company))


@bp.route("/api/billing/checkout", methods=["POST"])
def create_checkout():
    """Create a Stripe Checkout Session (mode=subscription) for the Pro plan.

    Quantity = current seat count (per-employee pricing). The subscription bills
    immediately, which covers both 'skip the trial and subscribe now' and
    'add a payment method after the trial'.
    """
    err = manager_required()
    if err:
        return err
    if not _configured():
        return jsonify({"error": "billing not configured"}), 503
    price = _price_id()
    if not price:
        return jsonify({"error": "billing price not configured"}), 503
    uid = current_uid()
    base = _app_base_url()
    with get_db() as db:
        company_id = _caller_company_id(db, uid)
        if company_id is None:
            return jsonify({"error": "no company"}), 404
        company = _company_row(db, company_id)
        if not company:
            return jsonify({"error": "company not found"}), 404
        seats = _seat_count(db, company_id)
    def _new_customer():
        cust = _stripe("POST", "/v1/customers", {
            "name": company.get("name") or "SwiftShift company",
            "metadata": {"swiftshift_company_id": str(company_id)},
        })
        with get_db() as db:
            db.execute(
                "UPDATE companies SET billing_customer_id = ? WHERE id = ?",
                (cust["id"], company_id),
            )
            db.commit()
        return cust["id"]

    def _new_session(cid):
        return _stripe("POST", "/v1/checkout/sessions", {
            "mode": "subscription",
            "customer": cid,
            "line_items": [{"price": price, "quantity": seats}],
            "payment_method_types": ["card", "us_bank_account"],
            "subscription_data": {"metadata": {"swiftshift_company_id": str(company_id)}},
            "allow_promotion_codes": True,
            "success_url": f"{base}/?billing=success",
            "cancel_url": f"{base}/?billing=cancel",
        })

    try:
        customer_id = company.get("billing_customer_id") or _new_customer()
        try:
            session = _new_session(customer_id)
        except StripeError as exc:
            # A saved customer id Stripe can't find (e.g. a test-mode customer
            # reused after switching to a live key) - drop it, make a fresh one,
            # and retry once so the manager isn't stuck.
            if customer_id and "No such customer" in (exc.message or ""):
                customer_id = _new_customer()
                session = _new_session(customer_id)
            else:
                raise
    except StripeError as exc:
        return jsonify({"error": exc.message}), 502
    return jsonify({"url": session["url"]})


@bp.route("/api/billing/portal", methods=["POST"])
def create_portal():
    """Stripe Billing Portal session: manage/cancel the subscription, update card."""
    err = manager_required()
    if err:
        return err
    if not _configured():
        return jsonify({"error": "billing not configured"}), 503
    uid = current_uid()
    base = _app_base_url()
    with get_db() as db:
        company_id = _caller_company_id(db, uid)
        company = _company_row(db, company_id) if company_id is not None else None
    customer_id = company.get("billing_customer_id") if company else None
    if not customer_id:
        return jsonify({"error": "no billing account yet"}), 400
    try:
        session = _stripe("POST", "/v1/billing_portal/sessions", {
            "customer": customer_id,
            "return_url": f"{base}/?billing=portal",
        })
    except StripeError as exc:
        return jsonify({"error": exc.message}), 502
    return jsonify({"url": session["url"]})


# --- webhook -----------------------------------------------------------------

def _verify_billing_signature(raw_body, sig_header):
    """Stripe signature check (stdlib only), same scheme as payments.py but using
    the billing endpoint's own secret. Falls back to STRIPE_WEBHOOK_SECRET so a
    single combined webhook endpoint also works."""
    secrets = [
        s for s in (
            os.environ.get("STRIPE_BILLING_WEBHOOK_SECRET"),
            os.environ.get("STRIPE_WEBHOOK_SECRET"),
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
    ref = (obj or {}).get("customer")
    return ref if isinstance(ref, str) else (ref or {}).get("id")


def _apply_subscription(sub):
    """A Stripe Subscription object -> companies plan/status, located by Stripe
    customer id (webhooks have no session) with a metadata fallback."""
    sub_id = sub.get("id")
    # Unknown / unexpected Stripe statuses fail closed (no accidental Pro grant).
    mapped = _STRIPE_STATUS_MAP.get(sub.get("status") or "", "past_due")
    plan = "pro" if mapped == "active" else "starter"
    with get_db() as db:
        company_id = _company_id_for_customer(db, _customer_id_of(sub))
        if company_id is None:
            meta_id = (sub.get("metadata") or {}).get("swiftshift_company_id")
            if meta_id and str(meta_id).isdigit():
                company_id = int(meta_id)
        if company_id is None:
            return
        db.execute(
            "UPDATE companies SET subscription_status = ?, plan = ?, "
            "billing_subscription_id = ? WHERE id = ?",
            (mapped, plan, sub_id, company_id),
        )
        db.commit()


def _set_status_by_customer(customer_id, status, plan=None):
    with get_db() as db:
        company_id = _company_id_for_customer(db, customer_id)
        if company_id is None:
            return
        if plan is not None:
            db.execute(
                "UPDATE companies SET subscription_status = ?, plan = ? WHERE id = ?",
                (status, plan, company_id),
            )
        else:
            db.execute(
                "UPDATE companies SET subscription_status = ? WHERE id = ?",
                (status, company_id),
            )
        db.commit()


def _handle_billing_event(event_type, event):
    obj = ((event.get("data") or {}).get("object")) or {}
    if event_type == "checkout.session.completed":
        if obj.get("mode") == "subscription" and obj.get("subscription"):
            sub = _stripe("GET", f"/v1/subscriptions/{obj['subscription']}")
            _apply_subscription(sub)
    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        _apply_subscription(obj)
    elif event_type == "customer.subscription.deleted":
        _set_status_by_customer(_customer_id_of(obj), "canceled", plan="starter")
    elif event_type == "invoice.payment_failed":
        _set_status_by_customer(_customer_id_of(obj), "past_due")
    elif event_type in ("invoice.paid", "invoice.payment_succeeded"):
        _set_status_by_customer(_customer_id_of(obj), "active", plan="pro")
    # anything else: ignore


@bp.route("/api/stripe/billing-webhook", methods=["POST"])
def billing_webhook():
    """Public (listed in app.py _PUBLIC_API_PATHS); authenticity is the signature."""
    if not _configured():
        return jsonify({"error": "billing not configured"}), 400
    raw_body = request.get_data()  # raw bytes, unmodified - required for HMAC
    if not _verify_billing_signature(raw_body, request.headers.get("Stripe-Signature", "")):
        return jsonify({"error": "invalid signature"}), 400
    try:
        event = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return jsonify({"error": "invalid payload"}), 400
    event_id = event.get("id")
    event_type = event.get("type") or ""
    # Idempotency via the shared stripe_events dedup table (created by payments.py).
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
        _handle_billing_event(event_type, event)
    except Exception:
        current_app.logger.exception("billing webhook handler failed (%s)", event_type)
        if event_id:
            try:
                with get_db() as db:
                    db.execute("DELETE FROM stripe_events WHERE stripe_event_id = ?", (event_id,))
                    db.commit()
            except Exception:
                pass
        return jsonify({"error": "event handling failed"}), 500
    return jsonify({"received": True})
