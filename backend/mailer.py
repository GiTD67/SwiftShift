"""Transactional email delivery via Resend's HTTP API.

Calls the REST endpoint directly so there's no new Python dependency (reuses
``requests``, already required). Configured entirely by environment:

  RESEND_API_KEY  required to actually send. If unset, send_email() is a no-op
                  that logs and returns False - so signup / password reset never
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
        logger.warning("RESEND_API_KEY not set - skipping email to %s (%s)", to, subject)
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


_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def _email_html(eyebrow, heading_html, intro, cta_label, href, note, preheader):
    """Render a transactional email in the scrollytelling aesthetic: pure black,
    one lime accent (#d7fe51), hairline borders, big grotesque type, a slab card
    echoing the landing finale. Table-based layout + inline styles so it survives
    Gmail / Apple Mail / Outlook (gradients/radii degrade to solid/square there)."""
    return f"""\
<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
</head>
<body style="margin:0;padding:0;background-color:#000000;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#000000;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;">
<tr><td align="center" style="padding:44px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="width:480px;max-width:100%;">
  <tr><td style="padding:0 4px 24px;">
    <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background-color:#d7fe51;vertical-align:middle;margin-right:9px;"></span>
    <span style="font-family:{_FONT};font-weight:700;letter-spacing:0.22em;font-size:13px;color:#f4f4f5;vertical-align:middle;">SWIFTSHIFT</span>
  </td></tr>
  <tr><td style="background-color:#0b0c10;background-image:linear-gradient(165deg,#14161c 0%,#0a0b0e 72%);border:1px solid rgba(255,255,255,0.09);border-radius:18px;padding:38px 32px;">
    <div style="font-family:{_FONT};font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(244,244,245,0.40);margin:0 0 16px;">{eyebrow}</div>
    <h1 style="font-family:{_FONT};font-size:30px;line-height:1.12;font-weight:600;letter-spacing:-0.02em;color:#f4f4f5;margin:0 0 16px;">{heading_html}</h1>
    <p style="font-family:{_FONT};font-size:15px;line-height:1.65;color:rgba(244,244,245,0.62);margin:0 0 28px;">{intro}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="#d7fe51" style="border-radius:8px;">
        <a href="{href}" style="display:inline-block;font-family:{_FONT};font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#000000;text-decoration:none;padding:14px 30px;border-radius:8px;">{cta_label} &rarr;</a>
      </td>
    </tr></table>
    <p style="font-family:{_FONT};font-size:12px;line-height:1.6;color:rgba(244,244,245,0.34);margin:26px 0 0;">{note}</p>
    <div style="margin-top:18px;padding:12px 14px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
      <div style="font-family:{_FONT};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(244,244,245,0.30);margin-bottom:6px;">Or paste this link</div>
      <a href="{href}" style="font-family:{_FONT};font-size:12px;color:#d7fe51;text-decoration:none;word-break:break-all;">{href}</a>
    </div>
  </td></tr>
  <tr><td style="padding:22px 6px 0;">
    <div style="font-family:{_FONT};font-size:11px;line-height:1.7;color:rgba(244,244,245,0.32);">
      If you didn&rsquo;t request this, you can safely ignore this email.<br>
      &copy; 2026 SwiftShift &middot; Time is money. Watch both, live.
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def send_verification_email(to, verify_url):
    """Email a 'confirm your address' link. Returns True on success."""
    html = _email_html(
        eyebrow="Verify your email",
        heading_html='One tap to <span style="color:#d7fe51;">verify</span>.',
        intro="Confirm this address to secure your SwiftShift account and start "
              "watching your pay accrue, live, to the cent.",
        cta_label="Verify email",
        href=verify_url,
        note="This link confirms it's really you. It expires in 24 hours.",
        preheader="Confirm your email to finish setting up SwiftShift.",
    )
    return send_email(
        to,
        "Verify your SwiftShift email",
        html,
        text=f"Verify your SwiftShift email: {verify_url}",
    )


def send_reset_email(to, reset_url):
    """Email a password-reset link. Returns True on success."""
    html = _email_html(
        eyebrow="Password reset",
        heading_html='Reset your <span style="color:#d7fe51;">password</span>.',
        intro="We received a request to reset your SwiftShift password. Choose a "
              "new one and you'll be back to clocking in within seconds.",
        cta_label="Reset password",
        href=reset_url,
        note="This link expires in 1 hour. If you didn't ask for it, your password "
             "stays exactly as it is.",
        preheader="Reset your SwiftShift password (link expires in 1 hour).",
    )
    return send_email(
        to,
        "Reset your SwiftShift password",
        html,
        text=f"Reset your SwiftShift password: {reset_url}",
    )
