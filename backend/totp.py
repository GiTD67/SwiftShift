"""Minimal RFC 6238 TOTP / RFC 4226 HOTP using only the standard library.

Avoids adding a dependency (e.g. pyotp). Uses the defaults every authenticator
app expects: 6 digits, 30-second step, SHA-1. Secrets are base32 (no padding)
so they drop straight into an otpauth:// URI / QR code.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote


def generate_secret(length=20):
    """Return a new random base32 secret (unpadded) for otpauth URIs."""
    raw = secrets.token_bytes(length)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _hotp(secret_b32, counter, digits=6):
    padding = "=" * (-len(secret_b32) % 8)
    key = base64.b32decode(secret_b32.upper() + padding)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code_int).zfill(digits)


def totp_now(secret_b32, step=30, digits=6, at=None):
    at = time.time() if at is None else at
    return _hotp(secret_b32, int(at // step), digits)


def verify(secret_b32, code, step=30, digits=6, window=1, at=None):
    """Verify a code across a ±window of time steps (clock-skew tolerance)."""
    if not code or not secret_b32:
        return False
    code = str(code).strip()
    if not code.isdigit() or len(code) != digits:
        return False
    at = time.time() if at is None else at
    counter = int(at // step)
    for w in range(-window, window + 1):
        try:
            if hmac.compare_digest(_hotp(secret_b32, counter + w, digits), code):
                return True
        except Exception:
            continue
    return False


def provisioning_uri(secret_b32, account_name, issuer="SwiftShift"):
    """Build the otpauth:// URI an authenticator app scans from a QR code."""
    label = quote(f"{issuer}:{account_name}")
    params = (
        f"secret={secret_b32}&issuer={quote(issuer)}"
        "&algorithm=SHA1&digits=6&period=30"
    )
    return f"otpauth://totp/{label}?{params}"
