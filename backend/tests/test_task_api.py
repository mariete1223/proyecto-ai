from __future__ import annotations

import re
import uuid
from collections.abc import Generator
from datetime import UTC, datetime
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
from app.models.enums import CategoryKind, TaskRecurrence, TaskStatus
from app.schemas.category import CategoryCreate
from app.schemas.entry import EntryCreate
from app.services.category_service import create_category
from app.services.entry_service import create_entry
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
    user = create_user(test_db_session, "taskuser@example.com", "Password123!")
    token = create_access_token(user_id=str(user.id), email=user.email)
    return {"Authorization": f"Bearer {token}"}


def test_get_pending_dateless_tasks_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user = test_db_session.query(User).filter_by(email="taskuser@example.com").one()
    task_cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(
            name="Tareas",
            voice_command="t",
            color="#FF0000",
            icon="task",
            kind=CategoryKind.TASK,
        ),
    )
    std_cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(
            name="Notas",
            voice_command="n",
            color="#00FF00",
            icon="note",
            kind=CategoryKind.STANDARD,
        ),
    )

    # Task 1: pending dateless
    t1, _ = create_entry(
        test_db_session,
        user.id,
        EntryCreate(
            category_id=task_cat.id,
            content="Task 1 pending dateless",
            task_status=TaskStatus.PENDING,
            task_recurrence=TaskRecurrence.ONCE,
        ),
    )

    # Task 2: in_progress dateless
    t2, _ = create_entry(
        test_db_session,
        user.id,
        EntryCreate(
            category_id=task_cat.id,
            content="Task 2 in progress dateless",
            task_status=TaskStatus.IN_PROGRESS,
            task_recurrence=TaskRecurrence.ONCE,
        ),
    )

    # Task 3: completed dateless (should not be listed as pending)
    create_entry(
        test_db_session,
        user.id,
        EntryCreate(
            category_id=task_cat.id,
            content="Task 3 completed dateless",
            task_status=TaskStatus.DONE,
            task_recurrence=TaskRecurrence.ONCE,
        ),
    )

    # Task 4: pending dated (should not be listed as dateless)
    create_entry(
        test_db_session,
        user.id,
        EntryCreate(
            category_id=task_cat.id,
            content="Task 4 dated",
            occurred_at=datetime.now(UTC),
            task_status=TaskStatus.PENDING,
            task_recurrence=TaskRecurrence.ONCE,
        ),
    )

    # Standard entry
    create_entry(
        test_db_session,
        user.id,
        EntryCreate(category_id=std_cat.id, content="Standard entry"),
    )

    response = client.get("/api/v1/tasks/pending", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    item_ids = [item["id"] for item in data["items"]]
    assert str(t1.id) in item_ids
    assert str(t2.id) in item_ids


def test_update_task_status_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user = test_db_session.query(User).filter_by(email="taskuser@example.com").one()
    task_cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(
            name="Tareas",
            voice_command="t",
            color="#FF0000",
            icon="task",
            kind=CategoryKind.TASK,
        ),
    )

    t1, _ = create_entry(
        test_db_session,
        user.id,
        EntryCreate(
            category_id=task_cat.id,
            content="Task to update status",
            task_status=TaskStatus.PENDING,
            task_recurrence=TaskRecurrence.ONCE,
        ),
    )

    patch_resp = client.patch(
        f"/api/v1/tasks/{t1.id}/status",
        headers=auth_headers,
        json={"task_status": "IN_PROGRESS"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["task_status"] == "IN_PROGRESS"
    assert patch_resp.json()["version"] == 2

    # Change to COMPLETED
    patch_resp2 = client.patch(
        f"/api/v1/tasks/{t1.id}/status",
        headers=auth_headers,
        json={"task_status": "DONE"},
    )
    assert patch_resp2.status_code == 200
    assert patch_resp2.json()["task_status"] == "DONE"

    # Verify no longer in pending list
    pending_resp = client.get("/api/v1/tasks/pending", headers=auth_headers)
    assert pending_resp.status_code == 200
    assert pending_resp.json()["total"] == 0


def test_update_task_status_non_task_category_fails(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user = test_db_session.query(User).filter_by(email="taskuser@example.com").one()
    std_cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(
            name="Notas",
            voice_command="n",
            color="#00FF00",
            icon="note",
            kind=CategoryKind.STANDARD,
        ),
    )

    entry, _ = create_entry(
        test_db_session,
        user.id,
        EntryCreate(category_id=std_cat.id, content="Standard entry"),
    )

    response = client.patch(
        f"/api/v1/tasks/{entry.id}/status",
        headers=auth_headers,
        json={"task_status": "IN_PROGRESS"},
    )
    assert response.status_code == 400


def test_update_task_status_not_found_and_user_isolation(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    non_existent_id = uuid.uuid4()
    resp_404 = client.patch(
        f"/api/v1/tasks/{non_existent_id}/status",
        headers=auth_headers,
        json={"task_status": "DONE"},
    )
    assert resp_404.status_code == 404

    other_user = create_user(test_db_session, "other@example.com", "Password123!")
    task_cat = create_category(
        test_db_session,
        other_user.id,
        CategoryCreate(
            name="Tareas Other",
            voice_command="to",
            color="#FF0000",
            icon="task",
            kind=CategoryKind.TASK,
        ),
    )
    other_task, _ = create_entry(
        test_db_session,
        other_user.id,
        EntryCreate(
            category_id=task_cat.id,
            content="Other user task",
            task_status=TaskStatus.PENDING,
            task_recurrence=TaskRecurrence.ONCE,
        ),
    )

    resp_iso = client.patch(
        f"/api/v1/tasks/{other_task.id}/status",
        headers=auth_headers,
        json={"task_status": "DONE"},
    )
    assert resp_iso.status_code == 404


def test_unauthenticated_task_api(client: TestClient) -> None:
    assert client.get("/api/v1/tasks/pending").status_code == 401
    assert (
        client.patch(
            f"/api/v1/tasks/{uuid.uuid4()}/status", json={"task_status": "DONE"}
        ).status_code
        == 401
    )
