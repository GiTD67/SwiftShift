"""Session/auth helpers: the logged-in user's id and manager-role checks.

Identity always comes from the signed session cookie (``session["uid"]``), never
from client-supplied input, so a request can't act as another user by changing an
id in the body or query string.
"""
from flask import session, jsonify

from db import get_db


def current_uid():
    """Return the logged-in user's id from the session, or None."""
    return session.get("uid")


def is_manager(uid=None):
    """True if the given user (default: the logged-in user) has the manager role.

    Fails closed: any lookup problem is treated as "not a manager".
    """
    if uid is None:
        uid = session.get("uid")
    if not uid:
        return False
    try:
        with get_db() as db:
            row = db.execute(
                "SELECT is_manager FROM users WHERE id = ?", (uid,)
            ).fetchone()
        return bool(row and row["is_manager"])
    except Exception:
        return False


def manager_required():
    """Return a 403 response if the caller is not a manager, else None.

    Usage::

        err = manager_required()
        if err:
            return err
    """
    if not is_manager():
        return jsonify({"error": "manager access required"}), 403
    return None
