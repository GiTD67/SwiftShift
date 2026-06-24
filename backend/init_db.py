"""One-time script to create all database tables. Run once after first deploy."""
import psycopg2
import os
import sys

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    # Exit 0 (not 1) so the container's "init_db.py && gunicorn" startup still
    # launches the web server; the database-independent frontend stays up.
    print(
        "WARNING: DATABASE_URL not set - skipping table init and starting the "
        "server anyway. Set DATABASE_URL for data features.",
        file=sys.stderr,
    )
    sys.exit(0)

try:
    conn = psycopg2.connect(DATABASE_URL)
except Exception as e:
    # A startup bootstrap must never block the web server from booting. If the
    # database is unreachable (e.g. an expired or rotated DB host), log and exit
    # 0 so gunicorn still starts and serves the frontend. Tables get created on
    # the next start once DATABASE_URL points at a reachable database.
    print(f"WARNING: cannot connect to database, skipping table init: {e}", file=sys.stderr)
    print(
        "Set DATABASE_URL to a reachable PostgreSQL connection string (Render or "
        "Neon) to enable login and data features.",
        file=sys.stderr,
    )
    sys.exit(0)
conn.autocommit = True
cur = conn.cursor()

tables = [
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
      salary REAL,
      hourly_rate REAL DEFAULT 20.0,
      pto_accrual_rate REAL DEFAULT 0.0385,
      streak_count INTEGER DEFAULT 0,
      streak_last_date TEXT,
      phone TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      filing_status TEXT DEFAULT 'single',
      extra_withholding REAL DEFAULT 0,
      notification_prefs TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS clock_sessions (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER,
      clock_in TEXT,
      clock_out TEXT,
      duration_minutes INTEGER,
      break_minutes INTEGER DEFAULT 0,
      notes TEXT,
      local_date TEXT
    )
    """,
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
    """,
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
    """,
    """
    CREATE TABLE IF NOT EXISTS timesheet_submissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      total_hours REAL NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (NOW()::text),
      UNIQUE (user_id, period_start)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS audit_events (
      id SERIAL PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (NOW()::text),
      user_id INTEGER,
      actor_name TEXT,
      action TEXT NOT NULL,
      detail TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS org_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      auto_approve_swap_hours REAL,
      ot_alert_daily_hours REAL NOT NULL DEFAULT 10,
      missed_clockout_hours REAL NOT NULL DEFAULT 12,
      updated_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS open_shifts (
      id SERIAL PRIMARY KEY,
      shift_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      job_or_role TEXT,
      posted_by INTEGER NOT NULL,
      claimed_by INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (NOW()::text)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS clock_correction_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      proposed_clock_in TEXT NOT NULL,
      proposed_clock_out TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (NOW()::text),
      reviewed_at TEXT
    )
    """,
]

try:
    for sql in tables:
        cur.execute(sql)
    print("All tables created/verified successfully!")
except Exception as e:
    # Best-effort: a schema hiccup must not block the server from starting.
    print(f"WARNING: table init incomplete (starting server anyway): {e}", file=sys.stderr)
finally:
    try:
        cur.close()
        conn.close()
    except Exception:
        pass
