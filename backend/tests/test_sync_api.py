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
    user = create_user(test_db_session, "syncuser@example.com", "Password123!")
    token = create_access_token(user_id=str(user.id), email=user.email)
    return {"Authorization": f"Bearer {token}"}


def test_sync_push_create_update_delete_flow(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    cat_id = str(uuid.uuid4())
    entry_id = str(uuid.uuid4())
    change1_id = str(uuid.uuid4())
    change2_id = str(uuid.uuid4())

    # 1. CREATE Category & Entry
    push_payload = {
        "client_changes": [
            {
                "change_id": change1_id,
                "entity_type": "CATEGORY",
                "entity_id": cat_id,
                "action": "CREATE",
                "base_version": 0,
                "payload": {
                    "name": "Sync Cat",
                    "voice_command": "sc",
                    "color": "#123456",
                    "icon": "sync",
                    "kind": "STANDARD",
                },
            },
            {
                "change_id": change2_id,
                "entity_type": "ENTRY",
                "entity_id": entry_id,
                "action": "CREATE",
                "base_version": 0,
                "payload": {
                    "category_id": cat_id,
                    "content": "Sync entry content",
                },
            },
        ]
    }

    resp1 = client.post("/api/v1/sync/push", headers=auth_headers, json=push_payload)
    assert resp1.status_code == 200
    res1_data = resp1.json()["results"]
    assert len(res1_data) == 2
    assert res1_data[0]["error_message"] is None, res1_data[0]["error_message"]
    assert res1_data[0]["status"] == "APPLIED"
    assert res1_data[0]["applied_version"] == 1
    assert res1_data[1]["status"] == "APPLIED"
    assert res1_data[1]["applied_version"] == 1

    # 2. Idempotent Retry of CREATE
    resp_retry = client.post(
        "/api/v1/sync/push", headers=auth_headers, json=push_payload
    )
    assert resp_retry.status_code == 200
    res_retry_data = resp_retry.json()["results"]
    assert res_retry_data[0]["status"] == "ALREADY_APPLIED"
    assert res_retry_data[1]["status"] == "ALREADY_APPLIED"

    # 3. UPDATE Entry
    change3_id = str(uuid.uuid4())
    update_payload = {
        "client_changes": [
            {
                "change_id": change3_id,
                "entity_type": "ENTRY",
                "entity_id": entry_id,
                "action": "UPDATE",
                "base_version": 1,
                "payload": {"content": "Updated sync entry content"},
            }
        ]
    }
    resp2 = client.post("/api/v1/sync/push", headers=auth_headers, json=update_payload)
    assert resp2.status_code == 200
    res2_data = resp2.json()["results"]
    assert res2_data[0]["status"] == "APPLIED"
    assert res2_data[0]["applied_version"] == 2

    # 4. CONFLICT: Push UPDATE with outdated base_version=1
    change4_id = str(uuid.uuid4())
    conflict_payload = {
        "client_changes": [
            {
                "change_id": change4_id,
                "entity_type": "ENTRY",
                "entity_id": entry_id,
                "action": "UPDATE",
                "base_version": 1,
                "payload": {"content": "Stale content"},
            }
        ]
    }
    resp_conflict = client.post(
        "/api/v1/sync/push", headers=auth_headers, json=conflict_payload
    )
    assert resp_conflict.status_code == 200
    res_conflict_data = resp_conflict.json()["results"]
    assert res_conflict_data[0]["status"] == "CONFLICT"
    assert (
        res_conflict_data[0]["server_entity"]["content"] == "Updated sync entry content"
    )

    # 5. DELETE Entry
    change5_id = str(uuid.uuid4())
    delete_payload = {
        "client_changes": [
            {
                "change_id": change5_id,
                "entity_type": "ENTRY",
                "entity_id": entry_id,
                "action": "DELETE",
                "base_version": 2,
                "payload": {},
            }
        ]
    }
    resp_del = client.post(
        "/api/v1/sync/push", headers=auth_headers, json=delete_payload
    )
    assert resp_del.status_code == 200
    res_del_data = resp_del.json()["results"]
    assert res_del_data[0]["status"] == "APPLIED"
    assert res_del_data[0]["applied_version"] == 3


def test_unauthenticated_sync_push(client: TestClient) -> None:
    assert (
        client.post("/api/v1/sync/push", json={"client_changes": []}).status_code == 401
    )


def test_sync_pull_initial_and_incremental(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    cat_id = str(uuid.uuid4())
    entry_id = str(uuid.uuid4())

    # Create category & entry via push
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
                        "name": "Pull Cat",
                        "voice_command": "pc",
                        "color": "#654321",
                        "icon": "pull",
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
                        "content": "Pull entry content",
                    },
                },
            ]
        },
    )

    # 1. Pull without cursor
    pull_resp = client.get("/api/v1/sync/pull", headers=auth_headers)
    assert pull_resp.status_code == 200
    pull_data = pull_resp.json()
    assert len(pull_data["changes"]) >= 2
    assert pull_data["next_cursor"] is not None
    cursor1 = pull_data["next_cursor"]

    # 2. Pull with cursor1 -> no changes
    pull_resp2 = client.get(f"/api/v1/sync/pull?cursor={cursor1}", headers=auth_headers)
    assert pull_resp2.status_code == 200
    assert len(pull_resp2.json()["changes"]) == 0
    assert len(pull_resp2.json()["tombstones"]) == 0

    # 3. Delete entry -> creates tombstone
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

    # 4. Incremental pull after cursor1 -> receives tombstone
    pull_resp3 = client.get(f"/api/v1/sync/pull?cursor={cursor1}", headers=auth_headers)
    assert pull_resp3.status_code == 200
    pull3_data = pull_resp3.json()
    assert len(pull3_data["tombstones"]) == 1
    assert pull3_data["tombstones"][0]["entity_id"] == entry_id
