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
from app.models.domain import Category, Entry, EntryTag, Tag, User
from app.schemas.category import CategoryCreate
from app.schemas.entry import EntryCreate
from app.schemas.tag import TagCreate
from app.services.category_service import create_category
from app.services.entry_service import create_entry
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
        dbapi_connection.create_function(
            "regexp",
            2,
            lambda expr, item: bool(re.search(expr, item)) if item else False,
        )

    User.metadata.create_all(
        bind=engine,
        tables=[
            cast(Table, User.__table__),
            cast(Table, Category.__table__),
            cast(Table, Tag.__table__),
            cast(Table, Entry.__table__),
            cast(Table, EntryTag.__table__),
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
    user = create_user(test_db_session, "entryuser@example.com", "Password123!")
    token = create_access_token(user_id=str(user.id), email=user.email)
    return {"Authorization": f"Bearer {token}"}


def test_create_entry_api_success(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user = test_db_session.query(User).filter_by(email="entryuser@example.com").one()
    cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(name="Cat", voice_command="c", color="#112233", icon="i"),
    )
    tag = create_tag(test_db_session, user.id, TagCreate(name="Tag"))

    response = client.post(
        "/api/v1/entries",
        headers=auth_headers,
        json={
            "category_id": str(cat.id),
            "content": "API Entry Content",
            "tag_ids": [str(tag.id)],
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "API Entry Content"
    assert data["category_id"] == str(cat.id)
    assert data["tag_ids"] == [str(tag.id)]
    assert data["version"] == 1


def test_get_entry_by_id_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user = test_db_session.query(User).filter_by(email="entryuser@example.com").one()
    cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(name="Cat", voice_command="c", color="#112233", icon="i"),
    )
    entry, _ = create_entry(
        test_db_session,
        user.id,
        EntryCreate(category_id=cat.id, content="Content to fetch"),
    )

    response = client.get(f"/api/v1/entries/{entry.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["content"] == "Content to fetch"


def test_user_isolation_entry_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    other_user = create_user(test_db_session, "otheruser@example.com", "Password123!")
    cat_other = create_category(
        test_db_session,
        other_user.id,
        CategoryCreate(name="Cat O", voice_command="co", color="#112233", icon="io"),
    )
    entry_other, _ = create_entry(
        test_db_session,
        other_user.id,
        EntryCreate(category_id=cat_other.id, content="Other user entry"),
    )

    response = client.get(f"/api/v1/entries/{entry_other.id}", headers=auth_headers)
    assert response.status_code == 404


def test_unauthenticated_entry_api_returns_401(client: TestClient) -> None:
    assert (
        client.get("/api/v1/entries/00000000-0000-0000-0000-000000000000").status_code
        == 401
    )
