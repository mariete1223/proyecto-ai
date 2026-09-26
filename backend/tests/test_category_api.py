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
from app.models.domain import Category, User
from app.schemas.category import CategoryCreate
from app.services.category_service import create_category
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
        tables=[cast(Table, User.__table__), cast(Table, Category.__table__)],
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
    user = create_user(test_db_session, "user1@example.com", "Password123!")
    token = create_access_token(user_id=str(user.id), email=user.email)
    return {"Authorization": f"Bearer {token}"}


def test_create_category_api_success(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/v1/categories",
        headers=auth_headers,
        json={
            "kind": "STANDARD",
            "name": "Trabajo",
            "voice_command": "crear trabajo",
            "description": "Notas de trabajo",
            "color": "#123456",
            "icon": "briefcase",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Trabajo"
    assert data["color"] == "#123456"
    assert data["version"] == 1


def test_list_categories_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    client.post(
        "/api/v1/categories",
        headers=auth_headers,
        json={
            "name": "Cat A",
            "voice_command": "cmd a",
            "color": "#111111",
            "icon": "icon_a",
        },
    )

    response = client.get("/api/v1/categories", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Cat A"


def test_get_and_update_category_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    post_resp = client.post(
        "/api/v1/categories",
        headers=auth_headers,
        json={
            "name": "Cat Initial",
            "voice_command": "cmd init",
            "color": "#000000",
            "icon": "icon",
        },
    )
    cat_id = post_resp.json()["id"]

    get_resp = client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Cat Initial"

    put_resp = client.put(
        f"/api/v1/categories/{cat_id}",
        headers=auth_headers,
        json={"name": "Cat Updated", "color": "#FFFFFF"},
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["name"] == "Cat Updated"
    assert put_resp.json()["color"] == "#FFFFFF"
    assert put_resp.json()["version"] == 2


def test_delete_category_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    post_resp = client.post(
        "/api/v1/categories",
        headers=auth_headers,
        json={
            "name": "To Delete",
            "voice_command": "delete me",
            "color": "#112233",
            "icon": "trash",
        },
    )
    cat_id = post_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/v1/categories/{cat_id}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_user_isolation_category_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user2 = create_user(test_db_session, "user2@example.com", "Password123!")
    cat_user2 = create_category(
        test_db_session,
        user2.id,
        CategoryCreate(
            name="User2 Cat", voice_command="u2 cmd", color="#123456", icon="icon"
        ),
    )

    get_resp = client.get(f"/api/v1/categories/{cat_user2.id}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_unauthenticated_category_api_returns_401(client: TestClient) -> None:
    assert client.get("/api/v1/categories").status_code == 401
    assert (
        client.post(
            "/api/v1/categories",
            json={
                "name": "X",
                "voice_command": "y",
                "color": "#112233",
                "icon": "z",
            },
        ).status_code
        == 401
    )
