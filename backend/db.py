import psycopg2
import psycopg2.extras

DATABASE_URL = "postgresql://root:root@localhost:5432/devdb"


class _CursorWrapper:
    """Wrapper to mimic sqlite3 cursor with lastrowid support."""

    def __init__(self, cursor):
        self._cursor = cursor
        self.lastrowid = None

    def execute(self, sql, params=None):
        # Convert ? to %s for psycopg2
        sql = sql.replace("?", "%s")
        self._cursor.execute(sql, params)
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
