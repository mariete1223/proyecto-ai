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
from app.schemas.category import CategoryCreate
from app.schemas.entry import EntryCreate
from app.schemas.tag import TagCreate
from app.services.category_service import create_category
from app.services.entry_service import (
    EntryNotFoundError,
    InvalidEntryDataError,
    create_entry,
    get_entry_by_id,
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
    fake_cat_id = CategoryCreate(
        name="Cat", voice_command="cmd", color="#112233", icon="icon"
    )
    data = EntryCreate(
        category_id=cat_id
        if (cat_id := getattr(fake_cat_id, "id", None))
        else create_user(db_session, "other@example.com", "Pass12345!").id,
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

    with pytest.raises(EntryNotFoundError):
        get_entry_by_id(
            db_session,
            user.id,
            create_user(db_session, "other2@example.com", "Password123!").id,
        )
