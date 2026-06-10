"""Append-only audit trail: log_event records who did what for the Audit Log view."""
from db import get_db

_DDL = """
CREATE TABLE IF NOT EXISTS audit_events (
  id SERIAL PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (NOW()::text),
  user_id INTEGER,
  actor_name TEXT,
  action TEXT NOT NULL,
  detail TEXT
)
"""


def _ensure_table(db):
    db.execute(_DDL)


def log_event(user_id, actor_name, action, detail):
    """Record an audit event. Best-effort: logging must never break the request.

    If actor_name is falsy it is looked up from the users table so call sites
    that only have a user id stay one-liners.
    """
    try:
        with get_db() as db:
            _ensure_table(db)
            if not actor_name and user_id:
                row = db.execute(
                    "SELECT first_name, last_name FROM users WHERE id = ?", (user_id,)
                ).fetchone()
                if row:
                    actor_name = f"{row['first_name']} {row['last_name']}".strip()
            db.execute(
                "INSERT INTO audit_events (user_id, actor_name, action, detail) VALUES (?, ?, ?, ?)",
                (user_id, actor_name, action, detail),
            )
            db.commit()
    except Exception:
        pass
