from __future__ import annotations

import re
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.domain import Category, Entry, EntryTag, Tag, User
from app.schemas.category import CategoryCreate
from app.schemas.entry import EntryCreate
from app.schemas.tag import TagCreate
from app.services.category_service import create_category
from app.services.entry_service import (
    EntryNotFoundError,
    InvalidEntryDataError,
    create_entry,
    get_entry_by_id,
    list_entries,
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


def test_create_entry_with_invalid_category_raises_error(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    data = EntryCreate(
        category_id=user.id,
        content="Test content",
    )

    with pytest.raises(InvalidEntryDataError):
        create_entry(db_session, user.id, data)


def test_create_entry_with_foreign_tag_raises_error(db_session: Session) -> None:
    user1 = create_user(db_session, "user1@example.com", "Password123!")
    user2 = create_user(db_session, "user2@example.com", "Password123!")

    cat1 = create_category(
        db_session,
        user1.id,
        CategoryCreate(name="Cat 1", voice_command="c1", color="#112233", icon="i1"),
    )
    tag_user2 = create_tag(db_session, user2.id, TagCreate(name="Tag User 2"))

    data = EntryCreate(
        category_id=cat1.id,
        content="Test content",
        tag_ids=[tag_user2.id],
    )

    with pytest.raises(InvalidEntryDataError):
        create_entry(db_session, user1.id, data)


def test_get_entry_by_id(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    cat = create_category(
        db_session,
        user.id,
        CategoryCreate(name="Cat", voice_command="c", color="#112233", icon="i"),
    )
    tag = create_tag(db_session, user.id, TagCreate(name="Tag"))

    entry, _ = create_entry(
        db_session,
        user.id,
        EntryCreate(category_id=cat.id, content="Content", tag_ids=[tag.id]),
    )

    fetched_entry, fetched_tag_ids = get_entry_by_id(db_session, user.id, entry.id)
    assert fetched_entry.id == entry.id
    assert fetched_tag_ids == [tag.id]

    other_user = create_user(db_session, "other2@example.com", "Password123!")
    with pytest.raises(EntryNotFoundError):
        get_entry_by_id(db_session, other_user.id, entry.id)


def test_list_entries_filtering_and_pagination(db_session: Session) -> None:
    user = create_user(db_session, "filter@example.com", "Password123!")
    cat1 = create_category(
        db_session,
        user.id,
        CategoryCreate(name="Cat 1", voice_command="c1", color="#111111", icon="i1"),
    )
    cat2 = create_category(
        db_session,
        user.id,
        CategoryCreate(name="Cat 2", voice_command="c2", color="#222222", icon="i2"),
    )
    tag1 = create_tag(db_session, user.id, TagCreate(name="Tag A"))

    now = datetime.now(UTC)
    t1 = now - timedelta(days=2)
    t2 = now - timedelta(days=1)
    t3 = now

    e1, _ = create_entry(
        db_session,
        user.id,
        EntryCreate(
            category_id=cat1.id, occurred_at=t1, content="Entry 1", tag_ids=[tag1.id]
        ),
    )
    e2, _ = create_entry(
        db_session,
        user.id,
        EntryCreate(category_id=cat2.id, occurred_at=t2, content="Entry 2"),
    )
    e3, _ = create_entry(
        db_session,
        user.id,
        EntryCreate(category_id=cat1.id, occurred_at=t3, content="Entry 3"),
    )

    # Test list all paginated
    entries, total = list_entries(db_session, user.id, page=1, limit=2)
    assert total == 3
    assert len(entries) == 2
    # Order by occurred_at desc -> e3, e2
    assert [e[0].id for e in entries] == [e3.id, e2.id]

    # Filter by category
    cat1_entries, cat1_total = list_entries(db_session, user.id, category_ids=[cat1.id])
    assert cat1_total == 2
    assert [e[0].id for e in cat1_entries] == [e3.id, e1.id]

    # Filter by tag
    tag1_entries, tag1_total = list_entries(db_session, user.id, tag_ids=[tag1.id])
    assert tag1_total == 1
    assert tag1_entries[0][0].id == e1.id

    # Filter by date range
    range_entries, range_total = list_entries(
        db_session,
        user.id,
        start_at=t1 - timedelta(hours=1),
        end_at=t2 + timedelta(hours=1),
    )
    assert range_total == 2
    assert [e[0].id for e in range_entries] == [e2.id, e1.id]
