from __future__ import annotations

import uuid
from collections.abc import Generator
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.auth import create_password_reset_token
from app.core.rate_limit import RateLimiter
from app.core.security import verify_password
from app.main import app
from app.models.domain import User
from app.services.email_service import clear_dispatched_emails, get_dispatched_emails
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
    def override_get_db() -> Generator[Session, None, None]:
        yield test_db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean_state() -> None:
    clear_dispatched_emails()
    RateLimiter.reset_all()


def test_forgot_password_unknown_email_returns_generic_message(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nonexistent@example.com"},
    )
    assert response.status_code == 200
    assert "recibirás un correo" in response.json()["message"]
    assert len(get_dispatched_emails()) == 0


def test_forgot_password_existing_user_dispatches_email(
    client: TestClient, test_db_session: Session
) -> None:
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    user = create_user(test_db_session, email, "Password1234!", is_verified=True)

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": email},
    )
    assert response.status_code == 200
    assert "recibirás un correo" in response.json()["message"]

    emails = get_dispatched_emails()
    assert len(emails) == 1
    assert emails[0]["to"] == user.email
    assert "Restablece tu contraseña" in emails[0]["subject"]
    assert "reset_token=" in emails[0]["link"]


def test_reset_password_success(client: TestClient, test_db_session: Session) -> None:
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    user = create_user(test_db_session, email, "OldPassword123!", is_verified=False)

    token = create_password_reset_token(user_id=str(user.id), email=user.email)

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "NewSecretPassword999!"},
    )
    assert response.status_code == 200
    assert "restablecida con éxito" in response.json()["message"]

    test_db_session.refresh(user)
    assert verify_password("NewSecretPassword999!", user.password_hash)
    assert not verify_password("OldPassword123!", user.password_hash)
    assert user.is_verified is True


def test_reset_password_invalid_token(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "invalid.jwt.token", "new_password": "NewSecretPassword999!"},
    )
    assert response.status_code == 400
    assert "Invalid or expired password reset token" in response.json()["detail"]


def test_reset_password_short_password(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "some-token", "new_password": "short"},
    )
    assert response.status_code == 422
