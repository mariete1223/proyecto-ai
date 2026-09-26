from __future__ import annotations

import hashlib
import secrets


def hash_password(password: str) -> str:
    """Hash a plaintext password using scrypt with a random salt."""
    salt = secrets.token_bytes(16)
    hashed = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1)
    return f"scrypt$16384$8$1${salt.hex()}${hashed.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored scrypt password hash."""
    try:
        parts = password_hash.split("$")
        if len(parts) != 6 or parts[0] != "scrypt":
            return False
        n = int(parts[1])
        r = int(parts[2])
        p = int(parts[3])
        salt = bytes.fromhex(parts[4])
        expected_hash = bytes.fromhex(parts[5])
        computed_hash = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=n, r=r, p=p
        )
        return secrets.compare_digest(computed_hash, expected_hash)
    except Exception:
        return False
