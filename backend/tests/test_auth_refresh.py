from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
import time
from typing import Any, cast
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.auth import create_access_token, decode_access_token, decode_token_for_refresh
from app.main import app
from app.models.domain import User
from app.services.user_service import create_user


@pytest.fixture
def test_db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def register_sqlite_functions(
        dbapi_connection: Any, connection_record: Any
    ) -> None:
        dbapi_connection.create_function(
            "btrim", 1, lambda val: val.strip() if val is not None else None
        )
        dbapi_connection.create_function(
            "char_length", 1, lambda val: len(val) if val is not None else 0
        )

    User.metadata.create_all(bind=engine, tables=[cast(Table, User.__table__)])
    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(test_db_session: Session) -> Generator[TestClient, None, None]:
    def _override_get_db() -> Generator[Session, None, None]:
        yield test_db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_refresh_token_valid_header(client: TestClient, test_db_session: Session) -> None:
    user = create_user(test_db_session, "user.refresh@example.com", "Password123!", is_verified=True)
    token = create_access_token(user_id=str(user.id), email=user.email, expires_in_seconds=3600)

    res = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    payload = decode_access_token(data["access_token"])
    assert payload["sub"] == str(user.id)
    assert payload["email"] == user.email


def test_refresh_token_valid_body(client: TestClient, test_db_session: Session) -> None:
    user = create_user(test_db_session, "user.body@example.com", "Password123!", is_verified=True)
    token = create_access_token(user_id=str(user.id), email=user.email, expires_in_seconds=3600)

    res = client.post("/api/v1/auth/refresh", json={"token": token})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    payload = decode_access_token(data["access_token"])
    assert payload["sub"] == str(user.id)


def test_refresh_token_expired_within_grace(client: TestClient, test_db_session: Session) -> None:
    user = create_user(test_db_session, "user.expired@example.com", "Password123!", is_verified=True)
    # Token expired 2 hours ago (-7200 seconds)
    token = create_access_token(user_id=str(user.id), email=user.email, expires_in_seconds=-7200)

    # Standard decode_access_token should reject it
    with pytest.raises(Exception):
        decode_access_token(token)

    # But refresh endpoint accepts it within grace period!
    res = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    payload = decode_access_token(data["access_token"])
    assert payload["sub"] == str(user.id)


def test_refresh_token_expired_beyond_grace(client: TestClient, test_db_session: Session) -> None:
    user = create_user(test_db_session, "user.ancient@example.com", "Password123!", is_verified=True)
    # Token expired 35 days ago
    token = create_access_token(user_id=str(user.id), email=user.email, expires_in_seconds=-35 * 86400)

    res = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_refresh_token_invalid_signature(client: TestClient, test_db_session: Session) -> None:
    user = create_user(test_db_session, "user.fake@example.com", "Password123!", is_verified=True)
    token = create_access_token(user_id=str(user.id), email=user.email, secret_key="different-secret")

    res = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_refresh_token_missing(client: TestClient) -> None:
    res = client.post("/api/v1/auth/refresh", json={})
    assert res.status_code == 401


def test_refresh_token_unverified_user(client: TestClient, test_db_session: Session) -> None:
    user = create_user(test_db_session, "user.unverified@example.com", "Password123!", is_verified=False)
    token = create_access_token(user_id=str(user.id), email=user.email)

    res = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_refresh_token_nonexistent_user(client: TestClient, test_db_session: Session) -> None:
    random_id = str(uuid.uuid4())
    token = create_access_token(user_id=random_id, email="ghost@example.com")

    res = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
