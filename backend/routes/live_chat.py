"""Public marketing live-chat: a presentational "agents available" widget that
answers product questions with Swifty AI and hands off to email when needed.

Public (no login) - listed in app.py _PUBLIC_API_PREFIXES. Rate-limited because
it is unauthenticated and calls a paid LLM. It never reads any account or user
data: it only answers questions about SwiftShift as a product and collects a
contact handoff that is emailed to the support inbox.
"""
import html
import os

from flask import Blueprint, jsonify, request
from openai import OpenAI

from limiter import limiter
from mailer import send_email

bp = Blueprint("live_chat", __name__)

_SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "sales@swiftshift.work")

_SALES_SYSTEM_PROMPT = (
    "You are the SwiftShift live chat assistant on the public marketing site. "
    "SwiftShift is a workforce time-tracking and payroll web app: employees clock "
    "in and out with a live to-the-second timer, take compliant meal breaks, "
    "submit timesheets, and request PTO and shift swaps; managers run payroll via "
    "Stripe (ACH funding plus employee payouts), pull reports, and manage a team "
    "across companies. There is a 30-day free Pro trial, then simple per-seat "
    "billing. Help prospective customers: answer questions about features, pricing, "
    "and getting started; be concise, friendly, and honest. You have NO access to "
    "any account or user data, so never claim to look anything up. If someone needs "
    "account-specific help or something you cannot answer, invite them to leave "
    "their email so a human follows up. Never use em dashes."
)


@bp.route("/api/live-chat/ask", methods=["POST"])
@limiter.limit("20 per minute")
def ask():
    data = request.get_json(silent=True) or {}
    history = data.get("messages")
    message = (data.get("message") or "").strip()
    msgs = []
    if isinstance(history, list):
        for m in history[-8:]:
            if not isinstance(m, dict):
                continue
            role = m.get("role")
            content = (m.get("content") or "").strip()
            if role in ("user", "assistant") and content:
                msgs.append({"role": role, "content": content[:2000]})
    if message:
        msgs.append({"role": "user", "content": message[:2000]})
    if not msgs:
        return jsonify({"error": "message required"}), 400

    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        # AI not configured: stay honest and route straight to the email handoff.
        return jsonify({
            "reply": "Thanks for reaching out! Our team isn't on live chat this "
                     "second, but leave your email below and a real person will get "
                     "back to you shortly.",
            "handoff": True,
        })
    try:
        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", timeout=40)
        resp = client.chat.completions.create(
            model="grok-4.20-0309-reasoning",
            messages=[{"role": "system", "content": _SALES_SYSTEM_PROMPT}] + msgs,
            max_tokens=600,
        )
        reply = (resp.choices[0].message.content or "").strip()
        if not reply:
            raise ValueError("empty reply")
        return jsonify({"reply": reply})
    except Exception:
        return jsonify({
            "reply": "Sorry, I'm having trouble answering right now. Leave your "
                     "email below and our team will follow up with you directly.",
            "handoff": True,
        })


@bp.route("/api/live-chat/contact", methods=["POST"])
@limiter.limit("5 per minute")
def contact():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()[:120]
    email = (data.get("email") or "").strip()[:254]
    message = (data.get("message") or "").strip()[:4000]
    if not email or "@" not in email:
        return jsonify({"error": "a valid email is required"}), 400
    # Email the support inbox. Best-effort: we still return ok if mail is not
    # configured so the visitor always sees a confirmation.
    try:
        body = (
            "<p><strong>New live-chat handoff from the website</strong></p>"
            f"<p>Name: {html.escape(name) or '(not given)'}<br>"
            f"Email: {html.escape(email)}</p>"
            f"<p>Message:<br>{html.escape(message) or '(no message)'}</p>"
        )
        send_email(
            _SUPPORT_EMAIL,
            f"SwiftShift live chat: {name or email}",
            body,
            text=f"From {name or email} <{email}>:\n\n{message}",
        )
    except Exception:
        pass
    return jsonify({"ok": True})
