from __future__ import annotations

from collections.abc import Generator
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.auth import create_access_token
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


def test_login_success(client: TestClient, test_db_session: Session) -> None:
    email = "testuser@example.com"
    password = "MySecretPassword123!"
    create_user(test_db_session, email, password)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password_returns_401(
    client: TestClient, test_db_session: Session
) -> None:
    email = "testuser@example.com"
    password = "MySecretPassword123!"
    create_user(test_db_session, email, password)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword123!"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_nonexistent_user_returns_401(
    client: TestClient, test_db_session: Session
) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "SomePassword123!"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_get_me_success(client: TestClient, test_db_session: Session) -> None:
    email = "me@example.com"
    password = "MySecretPassword123!"
    user = create_user(test_db_session, email, password)
    token = create_access_token(user_id=str(user.id), email=user.email)

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user.id)
    assert data["email"] == email


def test_get_me_unauthorized_without_header(
    client: TestClient, test_db_session: Session
) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_me_unauthorized_with_invalid_token(
    client: TestClient, test_db_session: Session
) -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid_token_value"},
    )
    assert response.status_code == 401


def test_logout_success(client: TestClient, test_db_session: Session) -> None:
    email = "logout@example.com"
    password = "MySecretPassword123!"
    user = create_user(test_db_session, email, password)
    token = create_access_token(user_id=str(user.id), email=user.email)

    response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Successfully logged out."


def test_login_unverified_user_returns_403(
    client: TestClient, test_db_session: Session
) -> None:
    email = "unverified@example.com"
    password = "MySecretPassword123!"
    create_user(test_db_session, email, password, is_verified=False)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )

    assert response.status_code == 403
    assert "not verified" in response.json()["detail"].lower()


def test_register_success(client: TestClient, test_db_session: Session) -> None:
    from app.services.email_service import (
        clear_dispatched_emails,
        get_dispatched_emails,
    )

    clear_dispatched_emails()
    payload = {
        "email": "newuser@example.com",
        "password": "ValidPassword123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "message" in data
    assert "access_token" not in data
    assert data["email"] == "newuser@example.com"

    # Verify user was created in DB with is_verified=False
    user = (
        test_db_session.query(User)
        .filter(User.email_normalized == "newuser@example.com")
        .first()
    )
    assert user is not None
    assert user.is_verified is False

    # Verify email was dispatched
    emails = get_dispatched_emails()
    assert len(emails) == 1
    assert emails[0]["to"] == "newuser@example.com"
    assert "token" in emails[0]


def test_verify_email_post_and_login_success(
    client: TestClient, test_db_session: Session
) -> None:
    from app.services.email_service import get_dispatched_emails

    email = "tobedverified@example.com"
    password = "MyPassword123!"
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    dispatched = get_dispatched_emails()
    token = dispatched[-1]["token"]

    # Verify endpoint via POST
    verify_resp = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert verify_resp.status_code == 200
    assert "successfully verified" in verify_resp.json()["message"].lower()

    # Now login should succeed
    login_resp = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


def test_verify_email_get_success(client: TestClient, test_db_session: Session) -> None:
    from app.services.email_service import get_dispatched_emails

    email = "getverify@example.com"
    password = "MyPassword123!"
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    dispatched = get_dispatched_emails()
    token = dispatched[-1]["token"]

    # Verify endpoint via GET
    verify_resp = client.get(f"/api/v1/auth/verify-email?token={token}")
    assert verify_resp.status_code == 200
    assert "successfully verified" in verify_resp.json()["message"].lower()


def test_verify_email_invalid_token_returns_400(client: TestClient) -> None:
    resp = client.post("/api/v1/auth/verify-email", json={"token": "invalid-token-xyz"})
    assert resp.status_code == 400
    assert "invalid" in resp.json()["detail"].lower()


def test_verify_email_expired_token_returns_400(
    client: TestClient, test_db_session: Session
) -> None:
    from app.core.auth import create_verification_token

    user = create_user(
        test_db_session, "expired@example.com", "Password123!", is_verified=False
    )
    expired_token = create_verification_token(
        user_id=str(user.id), email=user.email, expires_in_seconds=-10
    )

    resp = client.post("/api/v1/auth/verify-email", json={"token": expired_token})
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_resend_verification_success(
    client: TestClient, test_db_session: Session
) -> None:
    from app.services.email_service import (
        clear_dispatched_emails,
        get_dispatched_emails,
    )

    create_user(
        test_db_session,
        "unverified_resend@example.com",
        "Password123!",
        is_verified=False,
    )
    clear_dispatched_emails()

    resp = client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "unverified_resend@example.com"},
    )
    assert resp.status_code == 200
    assert "sent" in resp.json()["message"].lower()

    emails = get_dispatched_emails()
    assert len(emails) == 1
    assert emails[0]["to"] == "unverified_resend@example.com"


def test_resend_verification_already_verified_returns_400(
    client: TestClient, test_db_session: Session
) -> None:
    create_user(
        test_db_session,
        "already_verified@example.com",
        "Password123!",
        is_verified=True,
    )

    resp = client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "already_verified@example.com"},
    )
    assert resp.status_code == 400
    assert "already verified" in resp.json()["detail"].lower()


def test_resend_verification_nonexistent_returns_404(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "nonexistent@example.com"},
    )
    assert resp.status_code == 404


def test_protected_route_rejects_unverified_user(
    client: TestClient, test_db_session: Session
) -> None:
    user = create_user(
        test_db_session,
        "unverified_access@example.com",
        "Password123!",
        is_verified=False,
    )
    token = create_access_token(user_id=str(user.id), email=user.email)

    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    assert "not verified" in resp.json()["detail"].lower()


def test_register_duplicate_email(client: TestClient, test_db_session: Session) -> None:
    create_user(test_db_session, "existing@example.com", "Password123!")
    payload = {
        "email": "existing@example.com",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_register_invalid_email(client: TestClient, test_db_session: Session) -> None:
    payload = {
        "email": "not-an-email",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
