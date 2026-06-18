"""Auth routes: signup, signin, Google OAuth, forgot/reset password."""
import hashlib
import time
import uuid

import requests as http_requests
from flask import Blueprint, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash

from audit import log_event
from db import get_db
from limiter import limiter
from mailer import APP_BASE_URL, send_reset_email, send_verification_email

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# The founder's account is always a manager, whether it already exists at boot
# (see _ensure_users_table) or gets created later via signup/Google.
FOUNDER_EMAIL = "trevordixon97@gmail.com"

# Upper bound guards against very long inputs being fed to the password hasher
# (a cheap DoS vector); the 8-char floor is the existing minimum.
MIN_PASSWORD_LEN = 8
MAX_PASSWORD_LEN = 128


def _password_pwned(password):
    """Return True if the password appears in the HaveIBeenPwned breach corpus.

    Uses the k-anonymity range API: only the first 5 hex chars of the SHA-1 are
    sent over the wire, never the password or its full hash. Fails OPEN (returns
    False) on any timeout/network/parse error so a third-party outage can never
    block a signup or password reset.
    """
    try:
        digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = digest[:5], digest[5:]
        resp = http_requests.get(
            f"https://api.pwnedpasswords.com/range/{prefix}",
            headers={"Add-Padding": "true"},
            timeout=2.5,
        )
        if not resp.ok:
            return False
        for line in resp.text.splitlines():
            line_suffix, _, _count = line.partition(":")
            if line_suffix.strip().upper() == suffix:
                return True
        return False
    except Exception:
        return False


def _password_problem(password, email=None):
    """Validate a password; return a user-facing error string, or None if OK.

    Shared by signup and reset-password so neither path can set a weaker
    password than the other.
    """
    if not password or len(password) < MIN_PASSWORD_LEN:
        return f"Password must be at least {MIN_PASSWORD_LEN} characters"
    if len(password) > MAX_PASSWORD_LEN:
        return f"Password must be at most {MAX_PASSWORD_LEN} characters"
    if email and password.strip().lower() == email.strip().lower():
        return "Password can't be the same as your email"
    if _password_pwned(password):
        return "That password has appeared in a known data breach. Please choose a different one."
    return None


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
            "email_verified BOOLEAN DEFAULT FALSE",
            "phone TEXT",
            "address_line1 TEXT",
            "address_line2 TEXT",
            "city TEXT",
            "state TEXT",
            "zip TEXT",
            "emergency_contact_name TEXT",
            "emergency_contact_phone TEXT",
            "filing_status TEXT DEFAULT 'single'",
            "extra_withholding REAL DEFAULT 0",
            "notification_prefs TEXT",
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
                (FOUNDER_EMAIL,),
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


def _ensure_email_verification_tokens_table():
    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS email_verification_tokens (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL,
              token TEXT UNIQUE NOT NULL,
              expires_at INTEGER NOT NULL,
              used INTEGER DEFAULT 0
            )
            """
        )


_ensure_email_verification_tokens_table()


def _issue_verification_email(user_id, email):
    """Create a 24h verification token and email the confirmation link.

    Best-effort: returns whether Resend accepted the message (False if email
    isn't configured), but never raises into the caller.
    """
    token = str(uuid.uuid4())
    expires_at = int(time.time()) + 86400  # 24 hours
    with get_db() as db:
        db.execute(
            "INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user_id, token, expires_at),
        )
        db.commit()
    return send_verification_email(email, f"{APP_BASE_URL}/verify-email?token={token}")


@bp.route("/signup", methods=["POST"])
@limiter.limit("10 per minute")
def signup():
    data = request.get_json() or {}
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")
    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "first_name, last_name, email, password required"}), 400
    # Shared rules: length bounds + breach check (see _password_problem).
    problem = _password_problem(password, email)
    if problem:
        return jsonify({"error": problem}), 400
    pw_hash = generate_password_hash(password)
    is_founder = email.strip().lower() == FOUNDER_EMAIL
    with get_db() as db:
        try:
            user = db.execute(
                "INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime, is_manager) VALUES (?, ?, ?, ?, 1, ?) RETURNING id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary, hourly_rate, pto_accrual_rate, streak_count, streak_last_date, is_manager",
                (first_name, last_name, email, pw_hash, is_founder),
            ).fetchone()
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                return jsonify({"error": "email already registered"}), 409
            raise
    user = dict(user)
    session.permanent = True
    session["uid"] = user["id"]
    # Best-effort verification email. The account is usable immediately so the
    # invite-accept step right after signup still works; the app shows an
    # "unverified" banner until the link is clicked.
    try:
        _issue_verification_email(user["id"], email)
    except Exception:
        pass
    user["email_verified"] = False
    return jsonify(user), 201


@bp.route("/signin", methods=["POST"])
@limiter.limit("10 per minute")
def signin():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "email, password required"}), 400
    with get_db() as db:
        # Case-insensitive match so "Alice@x.com" and "alice@x.com" are the same
        # account (forgot-password already normalizes this way). If legacy
        # duplicate-cased rows exist, prefer the exact-case row, then lowest id,
        # so the result is deterministic rather than optimizer-dependent.
        row = db.execute(
            "SELECT * FROM users WHERE LOWER(email) = LOWER(?) ORDER BY (email = ?) DESC, id ASC LIMIT 1",
            (email, email),
        ).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "invalid credentials"}), 401
    session.permanent = True
    session["uid"] = row["id"]
    log_event(row["id"], f"{row['first_name']} {row['last_name']}", "login", f"Signed in as {row['email']}")
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
        "email_verified": bool(row.get("email_verified")),
    })


@bp.route("/google", methods=["POST"])
@limiter.limit("10 per minute")
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
        row = db.execute(
            "SELECT * FROM users WHERE LOWER(email) = LOWER(?) ORDER BY (email = ?) DESC, id ASC LIMIT 1",
            (email, email),
        ).fetchone()
        if not row:
            row = db.execute(
                "INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime, is_manager)"
                " VALUES (?, ?, ?, ?, 1, ?)"
                " RETURNING id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary, hourly_rate, pto_accrual_rate, streak_count, streak_last_date, is_manager",
                (given_name or "Google", family_name or "User", email, "google-oauth",
                 email.strip().lower() == FOUNDER_EMAIL),
            ).fetchone()

    session.permanent = True
    session["uid"] = row["id"]
    log_event(row["id"], f"{row['first_name']} {row['last_name']}", "login", f"Signed in with Google as {row['email']}")
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
        "email_verified": bool(row.get("email_verified")),
    })


@bp.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per minute")
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 400

    # Always respond with the same generic message so the endpoint can't be used
    # to discover which emails are registered, and never return the reset token.
    generic = {"message": "If that email is registered, a reset link has been sent."}

    with get_db() as db:
        row = db.execute("SELECT id, email FROM users WHERE LOWER(email) = ?", (email,)).fetchone()
        if not row:
            return jsonify(generic)

        token = str(uuid.uuid4())
        expires_at = int(time.time()) + 3600  # 1 hour expiry
        db.execute(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            (row["id"], token, expires_at),
        )
        db.commit()
        target_email = row["email"]

    # Email the reset link (best-effort). The token is never returned in the
    # response, so this endpoint can't be used to harvest tokens or to tell
    # whether an email is registered (the response is identical either way).
    send_reset_email(target_email, f"{APP_BASE_URL}/reset-password?token={token}")
    return jsonify(generic)


@bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@bp.route("/reset-password", methods=["POST"])
@limiter.limit("10 per minute")
def reset_password():
    data = request.get_json() or {}
    token = (data.get("token") or "").strip()
    new_password = data.get("password") or ""

    if not token or not new_password:
        return jsonify({"error": "token and password required"}), 400
    problem = _password_problem(new_password)
    if problem:
        return jsonify({"error": problem}), 400

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


@bp.route("/verify-email", methods=["POST"])
@limiter.limit("10 per minute")
def verify_email():
    data = request.get_json() or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "token required"}), 400

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM email_verification_tokens WHERE token = ? AND used = 0",
            (token,),
        ).fetchone()
        if not row:
            return jsonify({"error": "Invalid or already-used verification link"}), 400
        if int(time.time()) > row["expires_at"]:
            return jsonify({"error": "Verification link has expired. Please request a new one."}), 400
        db.execute("UPDATE users SET email_verified = TRUE WHERE id = ?", (row["user_id"],))
        db.execute("UPDATE email_verification_tokens SET used = 1 WHERE token = ?", (token,))
        db.commit()

    return jsonify({"message": "Email verified.", "email_verified": True})


@bp.route("/resend-verification", methods=["POST"])
@limiter.limit("3 per minute")
def resend_verification():
    # Lives under the public /api/auth prefix, so enforce a logged-in session
    # explicitly (the in-app "verify your email" prompt triggers this).
    uid = session.get("uid")
    if not uid:
        return jsonify({"error": "authentication required"}), 401
    with get_db() as db:
        row = db.execute("SELECT email, email_verified FROM users WHERE id = ?", (uid,)).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404
    if row.get("email_verified"):
        return jsonify({"message": "Email already verified.", "email_verified": True})
    _issue_verification_email(uid, row["email"])
    return jsonify({"message": "Verification email sent."})
