import os
import warnings
import psycopg2
import psycopg2.extras

_DEFAULT_DB_URL = "postgresql://root:root@localhost:5432/devdb"
DATABASE_URL = os.environ.get("DATABASE_URL", _DEFAULT_DB_URL)
if DATABASE_URL == _DEFAULT_DB_URL:
    warnings.warn(
        "DATABASE_URL is not set - using insecure default credentials. Set DATABASE_URL in production.",
        stacklevel=1,
    )


class _CursorWrapper:
    """Wrapper to mimic sqlite3 cursor with lastrowid support."""

    def __init__(self, cursor):
        self._cursor = cursor
        self.lastrowid = None
        self.rowcount = None

    def execute(self, sql, params=None):
        # Convert ? to %s for psycopg2
        sql = sql.replace("?", "%s")
        self._cursor.execute(sql, params)
        # Rows affected by this statement, captured before the lastrowid lookup
        # below changes the cursor state. Enables atomic compare-and-update.
        self.rowcount = self._cursor.rowcount
        # Try to capture lastrowid for INSERT statements
        if sql.strip().upper().startswith("INSERT") and "RETURNING" not in sql.upper():
            # Use currval if we can determine the sequence
            # This is a best-effort; prefer RETURNING in queries
            try:
                # Get table name from INSERT INTO table
                import re

                match = re.search(r"INSERT\s+INTO\s+(\w+)", sql, re.IGNORECASE)
                if match:
                    table = match.group(1)
                    self._cursor.execute(
                        f"SELECT currval(pg_get_serial_sequence('{table}', 'id'))"
                    )
                    row = self._cursor.fetchone()
                    if row:
                        self.lastrowid = row[0]
            except Exception:
                pass
        return self

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchone(self):
        return self._cursor.fetchone()


class _ConnWrapper:
    """Wrapper to make psycopg2 connection behave like sqlite3 connection."""

    def __init__(self, conn):
        self._conn = conn

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self._conn.commit()
        else:
            self._conn.rollback()
        self._conn.close()

    def execute(self, sql, params=None):
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        wrapper = _CursorWrapper(cur)
        wrapper.execute(sql, params)
        return wrapper

    def commit(self):
        self._conn.commit()


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    return _ConnWrapper(conn)


def safe_bootstrap(ensure_fn):
    """Run an import-time CREATE-TABLE-IF-NOT-EXISTS bootstrap without ever
    letting a database outage crash startup.

    The _ensure_*_table() helpers run at module import. A hard DB connect there
    means an unreachable database takes down the ENTIRE web service, including
    the static frontend, which needs no database at all. Wrapping the call lets
    the app still boot and serve the frontend; the bootstrap re-runs and
    succeeds on the next start once DATABASE_URL points at a reachable database
    (Render restarts the service when its env vars change).
    """
    try:
        ensure_fn()
    except Exception as exc:  # bootstrap must never be fatal at import time
        import sys
        name = getattr(ensure_fn, "__name__", repr(ensure_fn))
        sys.stderr.write(
            f"WARNING: skipping DB bootstrap {name} "
            f"(database unavailable at startup): {exc}\n"
        )
