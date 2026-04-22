"""Auth routes: signup and signin."""
from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash

from db import get_db
from limiter import limiter

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def init_db():
    """Create all required tables if they do not exist. Called once at startup."""
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
        for col in ("job_role", "manager_name"):
            try:
                db.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT")
                db.commit()
            except Exception:
                pass
        for col in ("is_fulltime", "pay", "salary"):
            try:
                if col == "is_fulltime":
                    db.execute(f"ALTER TABLE users ADD COLUMN {col} INTEGER DEFAULT 1")
                else:
                    db.execute(f"ALTER TABLE users ADD COLUMN {col} REAL")
                db.commit()
            except Exception:
                pass

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

    with get_db() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS clock_sessions (
              id SERIAL PRIMARY KEY,
              employee_id INTEGER,
              clock_in TEXT,
              clock_out TEXT,
              duration_minutes INTEGER,
              notes TEXT
            )
            """
        )


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
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400
    pw_hash = generate_password_hash(password)
    with get_db() as db:
        try:
            user = db.execute(
                "INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime) VALUES (?, ?, ?, ?, 1) RETURNING id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary",
                (first_name, last_name, email, pw_hash),
            ).fetchone()
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                return jsonify({"error": "email already registered"}), 409
            raise
    return jsonify(dict(user)), 201


@bp.route("/signin", methods=["POST"])
@limiter.limit("10 per minute")
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
    })
