from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from app.core.config import get_secret_key


class InvalidTokenError(ValueError):
    """Raised when a token is invalid, corrupted, or expired."""


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64decode(data_str: str) -> bytes:
    padding = "=" * (-len(data_str) % 4)
    return base64.urlsafe_b64decode(data_str + padding)


def create_access_token(
    user_id: str,
    email: str,
    expires_in_seconds: int = 86400,
    secret_key: str | None = None,
) -> str:
    """Create a signed JWT access token for a user."""
    if secret_key is None:
        secret_key = get_secret_key()

    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + expires_in_seconds,
    }

    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    unsigned_token = f"{_b64encode(header_bytes)}.{_b64encode(payload_bytes)}"
    signature = hmac.new(
        secret_key.encode("utf-8"),
        unsigned_token.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return f"{unsigned_token}.{_b64encode(signature)}"


def decode_access_token(token: str, secret_key: str | None = None) -> dict[str, Any]:
    """Decode and verify a signed JWT access token."""
    if secret_key is None:
        secret_key = get_secret_key()

    parts = token.split(".")
    if len(parts) != 3:
        raise InvalidTokenError("Invalid token structure.")

    header_b64, payload_b64, signature_b64 = parts
    unsigned_token = f"{header_b64}.{payload_b64}"

    expected_signature = hmac.new(
        secret_key.encode("utf-8"),
        unsigned_token.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    try:
        provided_signature = _b64decode(signature_b64)
    except Exception:
        raise InvalidTokenError("Invalid token signature encoding.") from None

    if not hmac.compare_digest(provided_signature, expected_signature):
        raise InvalidTokenError("Token signature verification failed.")

    try:
        payload_bytes = _b64decode(payload_b64)
        payload: dict[str, Any] = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise InvalidTokenError("Invalid token payload.") from None

    now = int(time.time())
    exp = payload.get("exp")
    if exp is None or not isinstance(exp, (int, float)) or now >= exp:
        raise InvalidTokenError("Token has expired.")

    return payload
