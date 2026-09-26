from __future__ import annotations

import uuid
from collections.abc import Generator
from typing import Any, cast

import pytest
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import verify_password
from app.models.domain import User
from app.services.user_service import (
    InvalidUserDataError,
    UserAlreadyExistsError,
    create_user,
    normalize_email,
)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
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

    User.metadata.create_all(bind=engine, tables=[cast(Table, User.__table__)])
    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_normalize_email() -> None:
    raw_email = "  User.Name@Example.COM  "
    normalized = normalize_email(raw_email)
    assert normalized == "user.name@example.com"


def test_create_user_success(db_session: Session) -> None:
    email = "   Alice@Example.com "
    password = "SuperSecretPassword123!"

    user = create_user(db_session, email, password)

    assert isinstance(user.id, uuid.UUID)
    assert user.email == "Alice@Example.com"
    assert user.email_normalized == "alice@example.com"
    assert user.password_hash != password
    assert password not in user.password_hash
    assert verify_password(password, user.password_hash) is True
    assert user.version == 1
    assert user.created_at is not None
    assert user.updated_at is not None
    assert user.updated_at >= user.created_at


def test_create_user_duplicate_email_raises_error(db_session: Session) -> None:
    email1 = "bob@example.com"
    email2 = "  BOB@EXAMPLE.COM  "
    password = "AnotherPassword123!"

    create_user(db_session, email1, password)

    with pytest.raises(UserAlreadyExistsError) as exc_info:
        create_user(db_session, email2, password)

    assert "already exists" in str(exc_info.value)


@pytest.mark.parametrize(
    "invalid_email",
    [
        "",
        "   ",
        "invalidemail",
        "invalid@domain",
        "@example.com",
        "user@",
    ],
)
def test_create_user_invalid_email_raises_error(
    db_session: Session, invalid_email: str
) -> None:
    with pytest.raises(InvalidUserDataError):
        create_user(db_session, invalid_email, "ValidPassword123!")


@pytest.mark.parametrize(
    "invalid_password",
    [
        "",
        "   ",
        "short",
        "1234567",
    ],
)
def test_create_user_invalid_password_raises_error(
    db_session: Session, invalid_password: str
) -> None:
    with pytest.raises(InvalidUserDataError):
        create_user(db_session, "user@example.com", invalid_password)
