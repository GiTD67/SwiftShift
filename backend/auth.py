"""Auth routes: signup and signin.

Users table (create if not exists on import):

CREATE TABLE users (
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
);
"""
from flask import Blueprint, jsonify, request
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
        # Add columns if upgrading from older schema
        for col in ("job_role", "manager_name"):
            try:
                db.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT")
                db.commit()
            except Exception:
                pass  # column already exists or other error, ignore
        for col in ("is_fulltime", "pay", "salary"):
            try:
                if col == "is_fulltime":
                    db.execute(f"ALTER TABLE users ADD COLUMN {col} INTEGER DEFAULT 1")
                else:
                    db.execute(f"ALTER TABLE users ADD COLUMN {col} REAL")
                db.commit()
            except Exception:
                pass  # column already exists or other error, ignore
        for col_def in (
            "hourly_rate REAL DEFAULT 20.0",
            "pto_accrual_rate REAL DEFAULT 0.0385",
            "streak_count INTEGER DEFAULT 0",
            "streak_last_date TEXT",
        ):
            col = col_def.split()[0]
            try:
                db.execute(f"ALTER TABLE users ADD COLUMN {col_def}")
                db.commit()
            except Exception:
                pass  # column already exists
        # Add break_minutes to clock_sessions if upgrading from older schema
        try:
            db.execute("ALTER TABLE clock_sessions ADD COLUMN break_minutes INTEGER DEFAULT 0")
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
              notes TEXT
            )
            """
        )


_ensure_clock_sessions_table()


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
                "INSERT INTO users (first_name, last_name, email, password_hash, is_fulltime) VALUES (?, ?, ?, ?, 1) RETURNING id, first_name, last_name, email, job_role, manager_name, is_fulltime, pay, salary, hourly_rate, pto_accrual_rate, streak_count, streak_last_date",
                (first_name, last_name, email, pw_hash),
            ).fetchone()
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                return jsonify({"error": "email already registered"}), 409
            raise
    return jsonify(dict(user)), 201


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
    })
