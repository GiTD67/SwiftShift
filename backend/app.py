import os
import requests

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS

from db import get_db  # noqa: F401  # ensure db module is loaded
from routes import health_bp, employees_bp, time_entries_bp, clock_sessions_bp, users_bp, grok_bp, jobs_bp, pto_bp, availability_bp, shift_swaps_bp, timesheet_submissions_bp
from auth import bp as auth_bp

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB uploads
_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
CORS(app, origins=_allowed_origins)


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
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Register API blueprints
app.register_blueprint(health_bp)
app.register_blueprint(employees_bp)
app.register_blueprint(time_entries_bp)
app.register_blueprint(clock_sessions_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(grok_bp)
app.register_blueprint(jobs_bp)
app.register_blueprint(pto_bp)
app.register_blueprint(availability_bp)
app.register_blueprint(shift_swaps_bp)
app.register_blueprint(timesheet_submissions_bp)


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
    app.run(host="0.0.0.0", port=port, debug=True)
