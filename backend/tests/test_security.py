from __future__ import annotations

from app.core.security import hash_password, verify_password


def test_hash_password_produces_unique_hashes_for_same_password() -> None:
    password = "MySecurePassword123!"
    hash1 = hash_password(password)
    hash2 = hash_password(password)

    assert hash1 != hash2
    assert hash1.startswith("scrypt$")
    assert hash2.startswith("scrypt$")
    assert password not in hash1


def test_verify_password_correct_and_incorrect() -> None:
    password = "MySecurePassword123!"
    hashed = hash_password(password)

    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False


def test_verify_password_invalid_hash_format() -> None:
    assert verify_password("password", "invalid_hash_string") is False
    assert verify_password("password", "scrypt$16384$8") is False
    assert verify_password("password", "scrypt$invalid$8$1$salt$hash") is False
