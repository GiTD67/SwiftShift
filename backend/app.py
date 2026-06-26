import os
from datetime import timedelta

import requests

from flask import Flask, jsonify, send_from_directory, request, session
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from db import get_db  # noqa: F401  # ensure db module is loaded
from limiter import limiter
from routes import health_bp, employees_bp, time_entries_bp, clock_sessions_bp, users_bp, grok_bp, jobs_bp, timesheet_submissions_bp, pto_bp, availability_bp, shift_swaps_bp, holidays_bp, reports_bp, audit_log_bp, corrections_bp, org_settings_bp, open_shifts_bp, export_bp, onboarding_bp, payments_bp, billing_bp, live_chat_bp
from auth import bp as auth_bp
from routes.billing import (
    entitlement_for_uid,
    _configured as _billing_configured,
    _price_id as _billing_price_id,
)

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

app = Flask(__name__, static_folder=None)
# One reverse-proxy hop (Render) sets X-Forwarded-For; without this the rate
# limiter would key every client on the proxy's IP - a single shared bucket.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB uploads

# Login sessions: sign the cookie with SECRET_KEY (falls back to a random key so
# the app still boots locally; set SECRET_KEY in production so sessions survive
# restarts). The cookie is http-only, SameSite=Lax, Secure (HTTPS only), 30 days.
_secret_key = os.environ.get("SECRET_KEY")
if not _secret_key:
    import sys
    print(
        "WARNING: SECRET_KEY is not set - using an ephemeral random key. Login "
        "sessions will not survive restarts and will be inconsistent across "
        "gunicorn workers (random 401s). Set SECRET_KEY in production.",
        file=sys.stderr,
    )
app.secret_key = _secret_key or os.urandom(32)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=True,
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
)

_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "https://swiftshift.work").split(",")
CORS(app, origins=_allowed_origins, supports_credentials=True)
limiter.init_app(app)

# Routes that don't require a logged-in session.
_PUBLIC_API_PREFIXES = ("/api/auth/", "/api/kalshi/", "/api/live-chat/")
_PUBLIC_API_PATHS = ("/api/health", "/api/onboarding/invites/lookup", "/api/stripe/webhook", "/api/stripe/billing-webhook")

# Routes that stay writable even after a trial lapses, so a locked-out workspace
# can still pay, sign out, or reach support.
_READONLY_EXEMPT_PREFIXES = ("/api/auth/", "/api/billing/", "/api/live-chat/")
_WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")


@app.before_request
def _require_login_for_api():
    """Require a valid login session on every /api/* route except the public ones."""
    path = request.path
    if not path.startswith("/api/"):
        return None  # frontend SPA + static assets
    if request.method == "OPTIONS":
        return None  # let CORS preflight through
    if path in _PUBLIC_API_PATHS or any(path.startswith(prefix) for prefix in _PUBLIC_API_PREFIXES):
        return None
    uid = session.get("uid")
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    # Read-only paywall: once a workspace's free trial (or paid subscription) has
    # lapsed, reads still work but writes are blocked with 402 until it upgrades.
    # Billing/auth/support routes stay open so the workspace can recover. The gate
    # only engages when billing is fully configured, so unconfigured envs never
    # lock anyone out (mirrors the Swifty gate's fail-open).
    if request.method in _WRITE_METHODS and _billing_configured() and _billing_price_id():
        if not any(path.startswith(p) for p in _READONLY_EXEMPT_PREFIXES):
            try:
                with get_db() as db:
                    ent = entitlement_for_uid(db, uid)
                if not ent.get("entitled"):
                    return jsonify({
                        "error": "billing_required",
                        "read_only": True,
                        "message": "This workspace is in read-only mode. Visit billing to restore access.",
                    }), 402
            except Exception:
                pass  # never hard-fail a write because the entitlement check errored
    return None


@app.after_request
def _security_and_cache_headers(resp):
    """Baseline security headers + sensible caching for the SPA."""
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if request.path.startswith("/assets/"):
        # Vite emits content-hashed filenames, so these are safe to cache forever.
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif not request.path.startswith("/api/") and resp.mimetype == "text/html":
        # Never cache the SPA shell, so new deploys are picked up immediately.
        resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.route("/api/kalshi/markets")
def kalshi_markets():
    try:
        url = "https://api.elections.kalshi.com/trade-api/v2/markets"
        params = {
            "status": request.args.get("status", "open"),
            "limit": request.args.get("limit", "8"),
        }
        et = request.args.get("event_ticker")
        if et:
            params["event_ticker"] = et
        r = requests.get(url, params=params, timeout=10)
        return jsonify(r.json())
    except Exception:
        app.logger.exception("kalshi markets proxy failed")
        return jsonify({"error": "market data unavailable"}), 502

@app.route("/api/kalshi/events")
def kalshi_events():
    try:
        url = "https://api.elections.kalshi.com/trade-api/v2/events"
        params = {
            "status": request.args.get("status", "open"),
            "limit": request.args.get("limit", "6"),
        }
        r = requests.get(url, params=params, timeout=10)
        return jsonify(r.json())
    except Exception:
        app.logger.exception("kalshi events proxy failed")
        return jsonify({"error": "market data unavailable"}), 502

# Register API blueprints
app.register_blueprint(health_bp)
app.register_blueprint(employees_bp)
app.register_blueprint(time_entries_bp)
app.register_blueprint(clock_sessions_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(grok_bp)
app.register_blueprint(jobs_bp)
app.register_blueprint(timesheet_submissions_bp)
app.register_blueprint(pto_bp)
app.register_blueprint(availability_bp)
app.register_blueprint(shift_swaps_bp)
app.register_blueprint(holidays_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(audit_log_bp)
app.register_blueprint(corrections_bp)
app.register_blueprint(org_settings_bp)
app.register_blueprint(open_shifts_bp)
app.register_blueprint(export_bp)
app.register_blueprint(onboarding_bp)
app.register_blueprint(payments_bp)
app.register_blueprint(billing_bp)
app.register_blueprint(live_chat_bp)


# --- Frontend SPA ---
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    file_path = os.path.join(frontend_dir, path)
    if path and os.path.exists(file_path):
        return send_from_directory(frontend_dir, path)
    return send_from_directory(frontend_dir, "index.html")


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "method not allowed"}), 405

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "not found"}), 404
    return send_from_directory(frontend_dir, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
