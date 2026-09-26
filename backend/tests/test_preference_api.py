from __future__ import annotations

import re
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
from app.models.domain import SavePreference, User
from app.models.enums import SaveMode
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
        dbapi_connection.create_function(
            "regexp",
            2,
            lambda expr, item: bool(re.search(expr, item)) if item else False,
        )

    User.metadata.create_all(
        bind=engine,
        tables=[
            cast(Table, User.__table__),
            cast(Table, SavePreference.__table__),
        ],
    )
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


@pytest.fixture
def auth_headers(test_db_session: Session) -> dict[str, str]:
    user = create_user(test_db_session, "prefuser@example.com", "Password123!")
    token = create_access_token(user_id=str(user.id), email=user.email)
    return {"Authorization": f"Bearer {token}"}


def test_get_default_save_preference(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.get("/api/v1/preferences/save-mode", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == SaveMode.FAST_FORWARD
    assert data["version"] == 1


def test_update_save_preference(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    get_resp = client.get("/api/v1/preferences/save-mode", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["mode"] == "FAST_FORWARD"

    put_resp = client.put(
        "/api/v1/preferences/save-mode",
        headers=auth_headers,
        json={"mode": "PREVIEW_BEFORE_SAVE"},
    )
    assert put_resp.status_code == 200
    data = put_resp.json()
    assert data["mode"] == "PREVIEW_BEFORE_SAVE"
    assert data["version"] == 2

    # Repeat GET to confirm persistence
    get_resp2 = client.get("/api/v1/preferences/save-mode", headers=auth_headers)
    assert get_resp2.status_code == 200
    assert get_resp2.json()["mode"] == "PREVIEW_BEFORE_SAVE"


def test_update_save_preference_invalid_mode_returns_422(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.put(
        "/api/v1/preferences/save-mode",
        headers=auth_headers,
        json={"mode": "INVALID_MODE"},
    )
    assert response.status_code == 422


def test_save_preference_user_isolation(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    # Update user 1 to PREVIEW_BEFORE_SAVE
    client.put(
        "/api/v1/preferences/save-mode",
        headers=auth_headers,
        json={"mode": "PREVIEW_BEFORE_SAVE"},
    )

    # User 2
    user2 = create_user(test_db_session, "user2@example.com", "Password123!")
    token2 = create_access_token(user_id=str(user2.id), email=user2.email)
    headers2 = {"Authorization": f"Bearer {token2}"}

    # User 2 should still get default FAST_FORWARD
    resp2 = client.get("/api/v1/preferences/save-mode", headers=headers2)
    assert resp2.status_code == 200
    assert resp2.json()["mode"] == "FAST_FORWARD"


def test_unauthenticated_preference_api(client: TestClient) -> None:
    assert client.get("/api/v1/preferences/save-mode").status_code == 401
    assert (
        client.put(
            "/api/v1/preferences/save-mode", json={"mode": "FAST_FORWARD"}
        ).status_code
        == 401
    )
