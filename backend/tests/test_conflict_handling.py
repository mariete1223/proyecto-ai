from __future__ import annotations

import re
import uuid
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
from app.models.domain import (
    CaptureCorrection,
    Category,
    DeletionTombstone,
    Entry,
    EntryTag,
    SavePreference,
    Tag,
    User,
)
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
            cast(Table, SavePreference.__table__),
            cast(Table, CaptureCorrection.__table__),
            cast(Table, DeletionTombstone.__table__),
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
    user = create_user(test_db_session, "conflictuser@example.com", "Password123!")
    token = create_access_token(user_id=str(user.id), email=user.email)
    return {"Authorization": f"Bearer {token}"}


def test_entry_conflict_preserves_server_data(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    cat_id = str(uuid.uuid4())
    entry_id = str(uuid.uuid4())

    # Create category & entry (version 1)
    client.post(
        "/api/v1/sync/push",
        headers=auth_headers,
        json={
            "client_changes": [
                {
                    "change_id": str(uuid.uuid4()),
                    "entity_type": "CATEGORY",
                    "entity_id": cat_id,
                    "action": "CREATE",
                    "base_version": 0,
                    "payload": {
                        "name": "Cat",
                        "voice_command": "c",
                        "color": "#112233",
                        "icon": "i",
                        "kind": "STANDARD",
                    },
                },
                {
                    "change_id": str(uuid.uuid4()),
                    "entity_type": "ENTRY",
                    "entity_id": entry_id,
                    "action": "CREATE",
                    "base_version": 0,
                    "payload": {
                        "category_id": cat_id,
                        "content": "Server content v1",
                    },
                },
            ]
        },
    )

    # Server updates entry to version 2 (e.g. from web interface)
    client.post(
        "/api/v1/sync/push",
        headers=auth_headers,
        json={
            "client_changes": [
                {
                    "change_id": str(uuid.uuid4()),
                    "entity_type": "ENTRY",
                    "entity_id": entry_id,
                    "action": "UPDATE",
                    "base_version": 1,
                    "payload": {"content": "Server content v2"},
                }
            ]
        },
    )

    # Client (which went offline at version 1) attempts update with base_version=1
    conflict_resp = client.post(
        "/api/v1/sync/push",
        headers=auth_headers,
        json={
            "client_changes": [
                {
                    "change_id": str(uuid.uuid4()),
                    "entity_type": "ENTRY",
                    "entity_id": entry_id,
                    "action": "UPDATE",
                    "base_version": 1,
                    "payload": {"content": "Offline client content"},
                }
            ]
        },
    )

    assert conflict_resp.status_code == 200
    res = conflict_resp.json()["results"][0]
    assert res["status"] == "CONFLICT"
    assert res["server_entity"]["content"] == "Server content v2"
    assert res["server_entity"]["version"] == 2

    # Verify server content remains untouched at v2
    get_entry_resp = client.get(f"/api/v1/entries/{entry_id}", headers=auth_headers)
    assert get_entry_resp.status_code == 200
    assert get_entry_resp.json()["content"] == "Server content v2"
    assert get_entry_resp.json()["version"] == 2


def test_delete_vs_update_conflict(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    cat_id = str(uuid.uuid4())
    entry_id = str(uuid.uuid4())

    # Create category & entry
    client.post(
        "/api/v1/sync/push",
        headers=auth_headers,
        json={
            "client_changes": [
                {
                    "change_id": str(uuid.uuid4()),
                    "entity_type": "CATEGORY",
                    "entity_id": cat_id,
                    "action": "CREATE",
                    "base_version": 0,
                    "payload": {
                        "name": "Cat",
                        "voice_command": "c",
                        "color": "#112233",
                        "icon": "i",
                        "kind": "STANDARD",
                    },
                },
                {
                    "change_id": str(uuid.uuid4()),
                    "entity_type": "ENTRY",
                    "entity_id": entry_id,
                    "action": "CREATE",
                    "base_version": 0,
                    "payload": {
                        "category_id": cat_id,
                        "content": "Entry v1",
                    },
                },
            ]
        },
    )

    # Server deletes entry
    client.post(
        "/api/v1/sync/push",
        headers=auth_headers,
        json={
            "client_changes": [
                {
                    "change_id": str(uuid.uuid4()),
                    "entity_type": "ENTRY",
                    "entity_id": entry_id,
                    "action": "DELETE",
                    "base_version": 1,
                    "payload": {},
                }
            ]
        },
    )

    # Client attempts update after entry was deleted on server
    conflict_resp = client.post(
        "/api/v1/sync/push",
        headers=auth_headers,
        json={
            "client_changes": [
                {
                    "change_id": str(uuid.uuid4()),
                    "entity_type": "ENTRY",
                    "entity_id": entry_id,
                    "action": "UPDATE",
                    "base_version": 1,
                    "payload": {"content": "Offline update on deleted item"},
                }
            ]
        },
    )

    assert conflict_resp.status_code == 200
    res = conflict_resp.json()["results"][0]
    assert res["status"] == "CONFLICT"
