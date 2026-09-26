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
