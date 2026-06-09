"""Auth routes: signup, signin, Google OAuth, forgot/reset password."""
import time
import uuid

import requests as http_requests
from flask import Blueprint, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash

from db import get_db

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _ensure_users_table():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              first_name TEXT NOT NULL,
              last_name TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              job_role TEXT,
              manager_name TEXT,
              is_fulltime INTEGER DEFAULT 1,
              pay REAL,
              salary REAL
            )
            """
        )
        # Add columns if upgrading from older schema. Must use IF NOT EXISTS:
        # in Postgres a failed statement aborts the whole transaction, so a
        # raised "column already exists" error would make every statement after
        # it fail too, leaving the later columns missing and breaking signup.
        for col_def in (
            "job_role TEXT",
            "manager_name TEXT",
            "is_fulltime INTEGER DEFAULT 1",
            "pay REAL",
            "salary REAL",
            "hourly_rate REAL DEFAULT 20.0",
            "pto_accrual_rate REAL DEFAULT 0.0385",
            "streak_count INTEGER DEFAULT 0",
            "streak_last_date TEXT",
            "is_manager BOOLEAN DEFAULT FALSE",
        ):
            db.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_def}")
        # Add break_minutes to clock_sessions if upgrading from older schema
        # (IF EXISTS: on a fresh database this table is created later, with the
        # column already included).
        db.execute("ALTER TABLE IF EXISTS clock_sessions ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0")
        db.commit()
        # Always keep one admin: make the founder a manager if that account exists.
        try:
            db.execute(
                "UPDATE users SET is_manager = TRUE WHERE LOWER(email) = LOWER(?) AND is_manager IS NOT TRUE",
                ("trevordixon97@gmail.com",),
            )
            db.commit()
        except Exception:
            pass


_ensure_users_table()


def _ensure_jobs_table():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
              job_id SERIAL PRIMARY KEY,
              description TEXT,
              hiring_manager_id INTEGER,
              date_posted TEXT,
              date_expiry TEXT,
              salary TEXT,
              location TEXT
            )
            """
        )


_ensure_jobs_table()


def _ensure_employees_table():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS employees (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT
            )
            """
        )


_ensure_employees_table()


def _ensure_time_entries_table():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS time_entries (
              id SERIAL PRIMARY KEY,
              employee_id INTEGER,
              date TEXT,
              project TEXT,
              task TEXT,
              start_time TEXT,
              end_time TEXT,
              duration_minutes INTEGER,
              description TEXT
            )
            """
        )


_ensure_time_entries_table()


def _ensure_clock_sessions_table():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS clock_sessions (
              id SERIAL PRIMARY KEY,
              employee_id INTEGER,
              clock_in TEXT,
              clock_out TEXT,
              duration_minutes INTEGER,
              break_minutes INTEGER DEFAULT 0,
              notes TEXT
            )
            """
        )


_ensure_clock_sessions_table()


def _ensure_password_reset_tokens_table():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL,
              token TEXT UNIQUE NOT NULL,
              expires_at INTEGER NOT NULL,
              used INTEGER DEFAULT 0
            )
            """
        )


_ensure_password_reset_tokens_table()


@bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")
    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "first_name, last_name, email, password required"}), 400
    pw_hash = generate_password_hash(password)
    with get_db() as db:
        try:
            user = db.execute(
                "INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime) VALUES (?, ?, ?, ?, 1) RETURNING id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary, hourly_rate, pto_accrual_rate, streak_count, streak_last_date, is_manager",
                (first_name, last_name, email, pw_hash),
            ).fetchone()
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                return jsonify({"error": "email already registered"}), 409
            raise
    user = dict(user)
    session.permanent = True
    session["uid"] = user["id"]
    return jsonify(user), 201


@bp.route("/signin", methods=["POST"])
def signin():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "email, password required"}), 400
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "invalid credentials"}), 401
    session.permanent = True
    session["uid"] = row["id"]
    return jsonify({
        "id": row["id"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "email": row["email"],
        "job_role": row.get("job_role"),
        "manager_name": row.get("manager_name"),
        "is_fulltime": row.get("is_fulltime", 1),
        "pay": row.get("pay"),
        "salary": row.get("salary"),
        "hourly_rate": row.get("hourly_rate"),
        "pto_accrual_rate": row.get("pto_accrual_rate"),
        "streak_count": row.get("streak_count"),
        "streak_last_date": row.get("streak_last_date"),
        "is_manager": bool(row.get("is_manager")),
    })


@bp.route("/google", methods=["POST"])
def google_auth():
    data = request.get_json() or {}
    access_token = data.get("access_token")
    if not access_token:
        return jsonify({"error": "access_token required"}), 400

    try:
        resp = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        if not resp.ok:
            return jsonify({"error": "Invalid Google token"}), 401
        google_user = resp.json()
    except Exception:
        return jsonify({"error": "Google verification failed"}), 500

    email = google_user.get("email", "")
    given_name = google_user.get("given_name") or ""
    family_name = google_user.get("family_name") or ""
    if not email:
        return jsonify({"error": "Email not provided by Google"}), 400

    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row:
            row = db.execute(
                "INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime)"
                " VALUES (?, ?, ?, ?, 1)"
                " RETURNING id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary",
                (given_name or "Google", family_name or "User", email, "google-oauth"),
            ).fetchone()

    session.permanent = True
    session["uid"] = row["id"]
    return jsonify({
        "id": row["id"],
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "email": row["email"],
        "job_role": row.get("job_role"),
        "manager_name": row.get("manager_name"),
        "is_fulltime": row.get("is_fulltime", 1),
        "pay": row.get("pay"),
        "salary": row.get("salary"),
        "is_manager": bool(row.get("is_manager")),
    })


@bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 400

    # Always respond with the same generic message so the endpoint can't be used
    # to discover which emails are registered, and never return the reset token.
    generic = {"message": "If that email is registered, a reset link has been sent."}

    with get_db() as db:
        row = db.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        if not row:
            return jsonify(generic)

        token = str(uuid.uuid4())
        expires_at = int(time.time()) + 3600  # 1 hour expiry
        db.execute(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            (row["id"], token, expires_at),
        )
        db.commit()

    # NOTE: token is stored, not returned. Email delivery wires up the reset link.
    return jsonify(generic)


@bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}
    token = (data.get("token") or "").strip()
    new_password = data.get("password") or ""

    if not token or not new_password:
        return jsonify({"error": "token and password required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0",
            (token,),
        ).fetchone()

        if not row:
            return jsonify({"error": "Invalid or already-used reset link"}), 400
        if int(time.time()) > row["expires_at"]:
            return jsonify({"error": "Reset link has expired. Please request a new one."}), 400

        pw_hash = generate_password_hash(new_password)
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, row["user_id"]))
        db.execute("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", (token,))
        db.commit()

    return jsonify({"message": "Password updated successfully."})
