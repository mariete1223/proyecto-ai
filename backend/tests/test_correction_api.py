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
from app.models.domain import CaptureCorrection, Category, Entry, EntryTag, Tag, User
from app.models.enums import CorrectionField
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
        tables=[
            cast(Table, User.__table__),
            cast(Table, Category.__table__),
            cast(Table, Tag.__table__),
            cast(Table, Entry.__table__),
            cast(Table, EntryTag.__table__),
            cast(Table, CaptureCorrection.__table__),
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
    user = create_user(test_db_session, "corruser@example.com", "Password123!")
    token = create_access_token(user_id=str(user.id), email=user.email)
    return {"Authorization": f"Bearer {token}"}


def test_create_capture_correction_success_and_preserves_entry(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user = test_db_session.query(User).filter_by(email="corruser@example.com").one()
    cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(name="Cat", voice_command="c", color="#112233", icon="i"),
    )
    session_id = uuid.uuid4()
    now = datetime.now(UTC)

    # Insert entry with capture_session_id directly
    entry = Entry(
        id=uuid.uuid4(),
        user_id=user.id,
        category_id=cat.id,
        occurred_at=now,
        content="Accepted content after correction",
        task_status=None,
        task_recurrence=None,
        capture_session_id=session_id,
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(entry)
    test_db_session.commit()

    initial_updated_at = entry.updated_at
    initial_version = entry.version
    initial_content = entry.content

    response = client.post(
        "/api/v1/corrections",
        headers=auth_headers,
        json={
            "entry_id": str(entry.id),
            "capture_session_id": str(session_id),
            "field": CorrectionField.CONTENT,
            "interpreted_value": "Interpreted raw text",
            "accepted_value": "Accepted content after correction",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["field"] == CorrectionField.CONTENT
    assert data["interpreted_value"] == "Interpreted raw text"
    assert data["accepted_value"] == "Accepted content after correction"

    # Verify that entry was completely untouched by creating the correction
    test_db_session.refresh(entry)
    assert entry.content == initial_content
    assert entry.updated_at == initial_updated_at.replace(tzinfo=None)
    assert entry.version == initial_version


def test_create_capture_correction_mismatched_session_fails(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user = test_db_session.query(User).filter_by(email="corruser@example.com").one()
    cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(name="Cat", voice_command="c", color="#112233", icon="i"),
    )
    session_id = uuid.uuid4()
    now = datetime.now(UTC)

    entry = Entry(
        id=uuid.uuid4(),
        user_id=user.id,
        category_id=cat.id,
        content="Entry content",
        capture_session_id=session_id,
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(entry)
    test_db_session.commit()

    wrong_session_id = uuid.uuid4()
    response = client.post(
        "/api/v1/corrections",
        headers=auth_headers,
        json={
            "entry_id": str(entry.id),
            "capture_session_id": str(wrong_session_id),
            "field": CorrectionField.CONTENT,
            "interpreted_value": "x",
            "accepted_value": "y",
        },
    )

    assert response.status_code == 400


def test_list_capture_corrections_api(
    client: TestClient, test_db_session: Session, auth_headers: dict[str, str]
) -> None:
    user = test_db_session.query(User).filter_by(email="corruser@example.com").one()
    cat = create_category(
        test_db_session,
        user.id,
        CategoryCreate(name="Cat", voice_command="c", color="#112233", icon="i"),
    )
    session_id = uuid.uuid4()
    now = datetime.now(UTC)

    entry = Entry(
        id=uuid.uuid4(),
        user_id=user.id,
        category_id=cat.id,
        content="Entry content",
        capture_session_id=session_id,
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(entry)
    test_db_session.commit()

    client.post(
        "/api/v1/corrections",
        headers=auth_headers,
        json={
            "entry_id": str(entry.id),
            "capture_session_id": str(session_id),
            "field": CorrectionField.CONTENT,
            "interpreted_value": "x",
            "accepted_value": "y",
        },
    )

    response = client.get(
        f"/api/v1/corrections?entry_id={entry.id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["entry_id"] == str(entry.id)


def test_unauthenticated_corrections_api(client: TestClient) -> None:
    assert client.get("/api/v1/corrections").status_code == 401
