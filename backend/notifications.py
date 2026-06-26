"""Best-effort transactional notifications: the glue between app events and
mailer.py.

Every function here swallows its own errors (logs and returns) so a missed
notification can never break the business action that triggered it. Email itself
already degrades to a silent no-op when RESEND_API_KEY is unset, so these are
safe to call unconditionally from any route or webhook.

Identity rule: recipients are always resolved from the database by id/company,
never from client-supplied input.
"""
import json
import logging

import mailer
from db import get_db

logger = logging.getLogger(__name__)

# Mirror of users.py notification categories. None = mandatory (always send).
_PREF_DEFAULTS = {"pto": True, "swaps": True, "timesheet": True, "manager": True}


def _employee(db, uid):
    return db.execute(
        "SELECT email, first_name, notification_prefs FROM users WHERE id = ?",
        (uid,),
    ).fetchone()


def _opted_in(row, category):
    """Honor the recipient's per-category opt-out. Defaults to True (send)."""
    if not category:
        return True
    try:
        saved = json.loads((row["notification_prefs"] or "{}"))
        if isinstance(saved, dict) and category in saved:
            return bool(saved[category])
    except (TypeError, ValueError):
        pass
    return _PREF_DEFAULTS.get(category, True)


def _company_manager_recipients(db, company_id):
    """All managers of a company as (email, first_name). COALESCE(...,0) folds the
    legacy NULL-company tenant into a single bucket so it resolves too."""
    rows = db.execute(
        "SELECT email, first_name FROM users "
        "WHERE is_manager = TRUE AND COALESCE(company_id, 0) = COALESCE(?, 0) "
        "AND email IS NOT NULL",
        (company_id,),
    ).fetchall()
    return [(r["email"], r["first_name"]) for r in rows if r["email"]]


def notify_bank_connected(company_id, bank_name, last4):
    """Email every company manager that the payroll funding bank is verified."""
    try:
        with get_db() as db:
            recipients = _company_manager_recipients(db, company_id)
        for email, name in recipients:
            mailer.send_bank_connected_email(email, name, bank_name, last4)
    except Exception:
        logger.exception("notify_bank_connected failed (company_id=%s)", company_id)


def notify_paycheck_sent(user_id, gross_cents, hours, ot_hours, period_start, period_end):
    """Email an employee that their pay for a period has been sent."""
    try:
        with get_db() as db:
            row = _employee(db, user_id)
        if row and row["email"]:
            mailer.send_paycheck_email(
                row["email"], row["first_name"], gross_cents, hours, ot_hours,
                period_start, period_end,
            )
    except Exception:
        logger.exception("notify_paycheck_sent failed (user_id=%s)", user_id)


def notify_pto_decision(user_id, status, hours, start_date, end_date):
    """Email an employee that their PTO request was approved/denied (respects opt-out)."""
    try:
        with get_db() as db:
            row = _employee(db, user_id)
        if row and row["email"] and _opted_in(row, "pto"):
            mailer.send_pto_decision_email(
                row["email"], row["first_name"], status, hours, start_date, end_date,
            )
    except Exception:
        logger.exception("notify_pto_decision failed (user_id=%s)", user_id)


def notify_correction_decision(user_id, status, detail=""):
    """Email an employee that a time-punch correction was approved/denied.

    Always sent: corrections affect recorded hours and therefore pay.
    """
    try:
        with get_db() as db:
            row = _employee(db, user_id)
        if row and row["email"]:
            mailer.send_correction_decision_email(row["email"], row["first_name"], status, detail)
    except Exception:
        logger.exception("notify_correction_decision failed (user_id=%s)", user_id)


def notify_billing_event(company_id, event):
    """Email company managers of a billing lifecycle event (payment_failed/canceled/activated)."""
    try:
        with get_db() as db:
            recipients = _company_manager_recipients(db, company_id)
        for email, name in recipients:
            mailer.send_billing_alert_email(email, name, event)
    except Exception:
        logger.exception("notify_billing_event failed (company_id=%s)", company_id)


def notify_invite(email, name, code, company_name, join_url):
    """Email a prospective teammate their invite link and code."""
    try:
        if email:
            mailer.send_invite_email(email, name, code, company_name, join_url)
    except Exception:
        logger.exception("notify_invite failed (email=%s)", email)
