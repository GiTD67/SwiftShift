"""One-time script to create all database tables. Run once after first deploy."""
import psycopg2
import os
import sys

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL not set — add it in your Railway/Render environment variables.")

try:
    conn = psycopg2.connect(DATABASE_URL)
except psycopg2.OperationalError as e:
    print(f"ERROR: Cannot connect to database: {e}", file=sys.stderr)
    print(
        "Check that DATABASE_URL is set to your actual PostgreSQL connection string.\n"
        "On Railway: link a Postgres service and Railway will inject DATABASE_URL automatically.\n"
        "On Render: add DATABASE_URL in Environment → Environment Variables.",
        file=sys.stderr,
    )
    sys.exit(1)
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
      streak_last_date TEXT
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
      notes TEXT
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
]

for sql in tables:
    cur.execute(sql)
    print(f"Created/verified table")

cur.close()
conn.close()
print("All tables created successfully!")
