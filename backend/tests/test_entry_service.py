from __future__ import annotations

import re
from collections.abc import Generator
from datetime import UTC, datetime
from typing import Any, cast

import pytest
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.domain import Category, Entry, EntryTag, Tag, User
from app.models.enums import CategoryKind, TaskRecurrence, TaskStatus
from app.schemas.category import CategoryCreate
from app.schemas.entry import EntryCreate, EntryUpdate
from app.schemas.tag import TagCreate
from app.services.category_service import create_category
from app.services.entry_service import (
    InvalidEntryDataError,
    create_entry,
    update_entry,
)
from app.services.tag_service import create_tag
from app.services.user_service import create_user


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
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


def test_create_entry_success(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    cat = create_category(
        db_session,
        user.id,
        CategoryCreate(
            name="General", voice_command="gen", color="#112233", icon="icon"
        ),
    )
    tag1 = create_tag(db_session, user.id, TagCreate(name="Tag 1"))
    tag2 = create_tag(db_session, user.id, TagCreate(name="Tag 2"))

    now = datetime.now(UTC)
    data = EntryCreate(
        category_id=cat.id,
        occurred_at=now,
        content="  Mi primera entrada  ",
        tag_ids=[tag1.id, tag2.id],
    )

    entry, tag_ids = create_entry(db_session, user.id, data)

    assert entry.user_id == user.id
    assert entry.category_id == cat.id
    assert entry.content == "Mi primera entrada"
    assert set(tag_ids) == {tag1.id, tag2.id}
    assert entry.version == 1


def test_create_entry_task_category_defaults_and_validation(
    db_session: Session,
) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    task_cat = create_category(
        db_session,
        user.id,
        CategoryCreate(
            kind=CategoryKind.TASK,
            name="Tareas",
            voice_command="tar",
            color="#112233",
            icon="icon",
        ),
    )

    # Task without date and without status -> defaults to PENDING / ONCE
    entry, _ = create_entry(
        db_session,
        user.id,
        EntryCreate(category_id=task_cat.id, occurred_at=None, content="Comprar leche"),
    )
    assert entry.task_status == TaskStatus.PENDING
    assert entry.task_recurrence == TaskRecurrence.ONCE

    # Non-TASK category attempting to pass task_status raises error
    std_cat = create_category(
        db_session,
        user.id,
        CategoryCreate(
            name="Standard", voice_command="std", color="#112233", icon="icon"
        ),
    )
    with pytest.raises(InvalidEntryDataError):
        create_entry(
            db_session,
            user.id,
            EntryCreate(
                category_id=std_cat.id,
                content="Invalid",
                task_status=TaskStatus.PENDING,
            ),
        )


def test_update_entry_task_status(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    task_cat = create_category(
        db_session,
        user.id,
        CategoryCreate(
            kind=CategoryKind.TASK,
            name="Tareas",
            voice_command="tar",
            color="#112233",
            icon="icon",
        ),
    )
    entry, _ = create_entry(
        db_session,
        user.id,
        EntryCreate(category_id=task_cat.id, content="Hacer ejercicio"),
    )

    updated_entry, _ = update_entry(
        db_session,
        user.id,
        entry.id,
        EntryUpdate(task_status=TaskStatus.DONE),
    )
    assert updated_entry.task_status == TaskStatus.DONE
    assert updated_entry.task_recurrence == TaskRecurrence.ONCE
