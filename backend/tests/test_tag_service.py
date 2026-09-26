from __future__ import annotations

from collections.abc import Generator
from typing import Any, cast

import pytest
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.domain import Tag, User
from app.schemas.tag import TagCreate, TagUpdate
from app.services.tag_service import (
    TagAlreadyExistsError,
    TagNotFoundError,
    create_tag,
    delete_tag,
    get_tag_by_id,
    list_tags,
    normalize_tag_name,
    update_tag,
)
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


def test_normalize_tag_name() -> None:
    assert normalize_tag_name("  Urgent_Work-Task  ") == "urgent work task"


def test_create_tag_success(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    data = TagCreate(name="  Importante  ")

    tag = create_tag(db_session, user.id, data)

    assert tag.user_id == user.id
    assert tag.name == "Importante"
    assert tag.name_normalized == "importante"
    assert tag.version == 1


def test_create_tag_duplicate_raises_error(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    create_tag(db_session, user.id, TagCreate(name="Trabajo-Urgente"))

    with pytest.raises(TagAlreadyExistsError):
        create_tag(db_session, user.id, TagCreate(name="  TRABAJO URGENTE  "))

    with pytest.raises(TagAlreadyExistsError):
        create_tag(db_session, user.id, TagCreate(name="trabajo_urgente"))


def test_list_and_get_tag(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    tag1 = create_tag(db_session, user.id, TagCreate(name="B Tag"))
    _ = create_tag(db_session, user.id, TagCreate(name="A Tag"))

    tags = list_tags(db_session, user.id)
    assert len(tags) == 2
    assert [t.name for t in tags] == ["A Tag", "B Tag"]

    fetched = get_tag_by_id(db_session, user.id, tag1.id)
    assert fetched.id == tag1.id


def test_update_and_delete_tag(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    tag = create_tag(db_session, user.id, TagCreate(name="Old Tag"))

    updated = update_tag(db_session, user.id, tag.id, TagUpdate(name="New Tag"))
    assert updated.name == "New Tag"
    assert updated.name_normalized == "new tag"
    assert updated.version == 2

    delete_tag(db_session, user.id, tag.id)

    with pytest.raises(TagNotFoundError):
        get_tag_by_id(db_session, user.id, tag.id)
