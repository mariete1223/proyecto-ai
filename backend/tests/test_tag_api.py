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
from app.models.domain import Tag, User
from app.schemas.tag import TagCreate
from app.services.tag_service import create_tag
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

    User.metadata.create_all(
        bind=engine,
        tables=[cast(Table, User.__table__), cast(Table, Tag.__table__)],
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
    user = create_user(test_db_session, "taguser@example.com", "Password123!")
    token = create_access_token(user_id=str(user.id), email=user.email)
    return {"Authorization": f"Bearer {token}"}


def test_create_tag_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/api/v1/tags",
        headers=auth_headers,
        json={"name": "Urgente"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Urgente"
    assert data["version"] == 1


def test_list_tags_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    client.post("/api/v1/tags", headers=auth_headers, json={"name": "Tag B"})
    client.post("/api/v1/tags", headers=auth_headers, json={"name": "Tag A"})

    response = client.get("/api/v1/tags", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert [t["name"] for t in data] == ["Tag A", "Tag B"]


def test_get_and_update_tag_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    post_resp = client.post(
        "/api/v1/tags", headers=auth_headers, json={"name": "Initial"}
    )
    tag_id = post_resp.json()["id"]

    get_resp = client.get(f"/api/v1/tags/{tag_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Initial"

    put_resp = client.put(
        f"/api/v1/tags/{tag_id}",
        headers=auth_headers,
        json={"name": "Updated Tag"},
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["name"] == "Updated Tag"
    assert put_resp.json()["version"] == 2


def test_delete_tag_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    post_resp = client.post(
        "/api/v1/tags", headers=auth_headers, json={"name": "To Delete"}
    )
    tag_id = post_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/tags/{tag_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/v1/tags/{tag_id}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_user_isolation_tag_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    other_user = create_user(test_db_session, "other@example.com", "Password123!")
    tag_other = create_tag(test_db_session, other_user.id, TagCreate(name="Other Tag"))

    get_resp = client.get(f"/api/v1/tags/{tag_other.id}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_unauthenticated_tag_api_returns_401(client: TestClient) -> None:
    assert client.get("/api/v1/tags").status_code == 401
    assert client.post("/api/v1/tags", json={"name": "Tag"}).status_code == 401
