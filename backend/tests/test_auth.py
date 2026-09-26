from __future__ import annotations

import pytest

from app.core.auth import InvalidTokenError, create_access_token, decode_access_token


def test_create_and_decode_access_token_success() -> None:
    user_id = "00000000-0000-0000-0000-000000000001"
    email = "user@example.com"

    token = create_access_token(user_id=user_id, email=email, expires_in_seconds=3600)
    payload = decode_access_token(token)

    assert payload["sub"] == user_id
    assert payload["email"] == email
    assert "exp" in payload
    assert "iat" in payload


def test_decode_expired_token_raises_error() -> None:
    user_id = "00000000-0000-0000-0000-000000000001"
    email = "user@example.com"

    token = create_access_token(user_id=user_id, email=email, expires_in_seconds=-1)

    with pytest.raises(InvalidTokenError) as exc_info:
        decode_access_token(token)

    assert "expired" in str(exc_info.value)


def test_decode_tampered_token_raises_error() -> None:
    user_id = "00000000-0000-0000-0000-000000000001"
    email = "user@example.com"

    token = create_access_token(user_id=user_id, email=email, expires_in_seconds=3600)
    parts = token.split(".")
    tampered_token = f"{parts[0]}.{parts[1]}.invalid_signature"

    with pytest.raises(InvalidTokenError) as exc_info:
        decode_access_token(tampered_token)

    assert "signature" in str(exc_info.value)


def test_decode_invalid_structure_token_raises_error() -> None:
    with pytest.raises(InvalidTokenError):
        decode_access_token("not.a.valid.jwt.structure")

    with pytest.raises(InvalidTokenError):
        decode_access_token("invalidtoken")
