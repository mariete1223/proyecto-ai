from __future__ import annotations

import re
from collections.abc import Generator
from typing import Any, cast

import pytest
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.domain import Category, User
from app.models.enums import CategoryKind
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.services.category_service import (
    CategoryAlreadyExistsError,
    CategoryNotFoundError,
    create_category,
    delete_category,
    get_category_by_id,
    list_categories,
    seed_initial_categories,
    update_category,
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
        dbapi_connection.create_function(
            "regexp",
            2,
            lambda expr, item: bool(re.search(expr, item)) if item else False,
        )

    User.metadata.create_all(
        bind=engine,
        tables=[cast(Table, User.__table__), cast(Table, Category.__table__)],
    )
    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_create_category_success(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    data = CategoryCreate(
        kind=CategoryKind.STANDARD,
        name="  Notas  ",
        voice_command="  crear nota  ",
        description="Categoría de notas generales",
        color="#FFAA00",
        icon="book-open",
    )

    category = create_category(db_session, user.id, data)

    assert category.user_id == user.id
    assert category.name == "Notas"
    assert category.name_normalized == "notas"
    assert category.voice_command == "crear nota"
    assert category.voice_command_normalized == "crear nota"
    assert category.color == "#FFAA00"
    assert category.version == 1


def test_create_category_duplicate_name_raises_error(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    data1 = CategoryCreate(
        name="Notas",
        voice_command="nota 1",
        color="#112233",
        icon="icon1",
    )
    data2 = CategoryCreate(
        name="  NOTAS  ",
        voice_command="nota 2",
        color="#445566",
        icon="icon2",
    )

    create_category(db_session, user.id, data1)

    with pytest.raises(CategoryAlreadyExistsError) as exc_info:
        create_category(db_session, user.id, data2)

    assert "name already exists" in str(exc_info.value)


def test_create_category_duplicate_voice_command_raises_error(
    db_session: Session,
) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    data1 = CategoryCreate(
        name="Notas 1",
        voice_command="grabar nota",
        color="#112233",
        icon="icon1",
    )
    data2 = CategoryCreate(
        name="Notas 2",
        voice_command="  GRABAR NOTA  ",
        color="#445566",
        icon="icon2",
    )

    create_category(db_session, user.id, data1)

    with pytest.raises(CategoryAlreadyExistsError) as exc_info:
        create_category(db_session, user.id, data2)

    assert "voice command already exists" in str(exc_info.value)


def test_create_duplicate_special_kind_raises_error(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    data1 = CategoryCreate(
        kind=CategoryKind.TASK,
        name="Tarea 1",
        voice_command="tarea 1",
        color="#112233",
        icon="check",
    )
    data2 = CategoryCreate(
        kind=CategoryKind.TASK,
        name="Tarea 2",
        voice_command="tarea 2",
        color="#445566",
        icon="check-double",
    )

    create_category(db_session, user.id, data1)

    with pytest.raises(CategoryAlreadyExistsError) as exc_info:
        create_category(db_session, user.id, data2)

    assert "kind 'TASK' already exists" in str(exc_info.value)


def test_list_and_get_category(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    cat1 = create_category(
        db_session,
        user.id,
        CategoryCreate(
            name="Cat 1", voice_command="cmd 1", color="#001122", icon="icon1"
        ),
    )
    cat2 = create_category(
        db_session,
        user.id,
        CategoryCreate(
            name="Cat 2", voice_command="cmd 2", color="#334455", icon="icon2"
        ),
    )

    categories = list_categories(db_session, user.id)
    assert len(categories) == 2
    assert [c.id for c in categories] == [cat1.id, cat2.id]

    fetched = get_category_by_id(db_session, user.id, cat1.id)
    assert fetched.id == cat1.id


def test_update_and_delete_category(db_session: Session) -> None:
    user = create_user(db_session, "user@example.com", "Password123!")
    cat = create_category(
        db_session,
        user.id,
        CategoryCreate(
            name="Original", voice_command="original", color="#111111", icon="icon"
        ),
    )

    updated = update_category(
        db_session,
        user.id,
        cat.id,
        CategoryUpdate(name="Updated Name", color="#999999"),
    )
    assert updated.name == "Updated Name"
    assert updated.name_normalized == "updated name"
    assert updated.color == "#999999"
    assert updated.version == 2

    delete_category(db_session, user.id, cat.id)

    with pytest.raises(CategoryNotFoundError):
        get_category_by_id(db_session, user.id, cat.id)


def test_seed_initial_categories_is_idempotent(db_session: Session) -> None:
    user = create_user(db_session, "seed_user@example.com", "Password123!")

    first_seed = seed_initial_categories(db_session, user.id)
    assert len(first_seed) == 5

    all_categories = list_categories(db_session, user.id)
    assert len(all_categories) == 5

    kinds = {c.kind for c in all_categories}
    assert CategoryKind.TASK in kinds
    assert CategoryKind.EVENT in kinds
    assert CategoryKind.CAPTURE in kinds

    second_seed = seed_initial_categories(db_session, user.id)
    assert len(second_seed) == 0

    all_after_second = list_categories(db_session, user.id)
    assert len(all_after_second) == 5
