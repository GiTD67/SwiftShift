"""Transactional email delivery via Resend's HTTP API.

Calls the REST endpoint directly so there's no new Python dependency (reuses
``requests``, already required). Configured entirely by environment:

  RESEND_API_KEY  required to actually send. If unset, send_email() is a no-op
                  that logs and returns False — so signup / password reset never
                  crash just because email isn't configured yet.
  RESEND_FROM     From header, e.g. "SwiftShift <noreply@swiftshift.work>".
                  The domain must be verified in Resend.
  APP_BASE_URL    public origin used to build links (default swiftshift.work).
"""
import logging
import os

import requests

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "SwiftShift <noreply@swiftshift.work>")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://swiftshift.work").rstrip("/")


def is_configured():
    """True when an API key is present so callers can branch on availability."""
    return bool(RESEND_API_KEY)


def send_email(to, subject, html, text=None):
    """Send one transactional email. Returns True on apparent success.

    Never raises: on missing config or any API/network error it logs and returns
    False, so the auth flows that call it degrade gracefully instead of failing.
    """
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email to %s (%s)", to, subject)
        return False
    try:
        payload = {"from": RESEND_FROM, "to": [to], "subject": subject, "html": html}
        if text:
            payload["text"] = text
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=8,
        )
        if not resp.ok:
            logger.error("Resend send failed (%s): %s", resp.status_code, resp.text[:300])
            return False
        return True
    except Exception:
        logger.exception("Resend send raised")
        return False


def _shell(title, body_html):
    """Wrap content in a minimal on-brand (black/lime) email shell."""
    return f"""\
<div style="background:#000;color:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:40px 24px;">
  <div style="max-width:480px;margin:0 auto;">
    <div style="font-weight:700;letter-spacing:.18em;font-size:14px;color:#fff;margin-bottom:28px;">SWIFTSHIFT</div>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;color:#fff;">{title}</h1>
    {body_html}
    <div style="margin-top:36px;font-size:11px;color:rgba(244,244,245,.38);border-top:1px solid rgba(255,255,255,.12);padding-top:16px;">
      © 2026 SwiftShift. If you didn't request this, you can safely ignore this email.
    </div>
  </div>
</div>"""


def _button(href, label):
    return (
        f'<a href="{href}" style="display:inline-block;background:#d7fe51;color:#000;'
        f'text-decoration:none;font-weight:600;padding:12px 22px;border-radius:6px;'
        f'font-size:14px;">{label}</a>'
    )


def send_verification_email(to, verify_url):
    """Email a 'confirm your address' link. Returns True on success."""
    body = (
        '<p style="font-size:14px;line-height:1.6;color:rgba(244,244,245,.7);">'
        "Confirm this email address to secure your SwiftShift account.</p>"
        f'<p style="margin:24px 0;">{_button(verify_url, "Verify email →")}</p>'
        '<p style="font-size:12px;color:rgba(244,244,245,.38);word-break:break-all;">'
        f"Or paste this link: {verify_url}</p>"
    )
    return send_email(
        to,
        "Verify your SwiftShift email",
        _shell("Verify your email", body),
        text=f"Verify your SwiftShift email: {verify_url}",
    )


def send_reset_email(to, reset_url):
    """Email a password-reset link. Returns True on success."""
    body = (
        '<p style="font-size:14px;line-height:1.6;color:rgba(244,244,245,.7);">'
        "We received a request to reset your SwiftShift password. This link "
        "expires in 1 hour.</p>"
        f'<p style="margin:24px 0;">{_button(reset_url, "Reset password →")}</p>'
        '<p style="font-size:12px;color:rgba(244,244,245,.38);word-break:break-all;">'
        f"Or paste this link: {reset_url}</p>"
    )
    return send_email(
        to,
        "Reset your SwiftShift password",
        _shell("Reset your password", body),
        text=f"Reset your SwiftShift password: {reset_url}",
    )
