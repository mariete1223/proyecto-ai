from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import Mock

import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import session as database_session


@pytest.fixture(autouse=True)
def clear_database_factory_caches() -> Iterator[None]:
    database_session.get_session_factory.cache_clear()
    database_session.get_database_engine.cache_clear()
    yield
    database_session.get_session_factory.cache_clear()
    database_session.get_database_engine.cache_clear()


def test_engine_factory_uses_psycopg_without_connecting(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = Mock(spec=Engine)
    create_engine = Mock(return_value=engine)
    monkeypatch.setenv("DATABASE_URL", "postgresql://alice:secret@localhost/memory")
    monkeypatch.setattr(database_session, "create_engine", create_engine)

    first = database_session.get_database_engine()
    second = database_session.get_database_engine()

    assert first is engine
    assert second is engine
    assert create_engine.call_count == 1
    url = create_engine.call_args.args[0]
    assert url.drivername == "postgresql+psycopg"
    create_engine.assert_called_once_with(url, pool_pre_ping=True)
    engine.connect.assert_not_called()


def test_session_factory_is_reused_but_each_operation_gets_a_fresh_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first_session = Mock(spec=Session)
    second_session = Mock(spec=Session)
    factory = Mock(side_effect=(first_session, second_session))
    monkeypatch.setattr(database_session, "get_session_factory", lambda: factory)

    first_dependency = database_session.get_database_session()
    assert next(first_dependency) is first_session
    with pytest.raises(StopIteration):
        next(first_dependency)

    second_dependency = database_session.get_database_session()
    assert next(second_dependency) is second_session
    with pytest.raises(StopIteration):
        next(second_dependency)

    assert factory.call_count == 2
    first_session.commit.assert_called_once_with()
    first_session.rollback.assert_not_called()
    first_session.close.assert_called_once_with()
    second_session.commit.assert_called_once_with()
    second_session.rollback.assert_not_called()
    second_session.close.assert_called_once_with()


def test_failed_operation_rolls_back_and_closes_before_a_new_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    failed_session = Mock(spec=Session)
    next_session = Mock(spec=Session)
    factory = Mock(side_effect=(failed_session, next_session))
    monkeypatch.setattr(database_session, "get_session_factory", lambda: factory)

    failed_dependency = database_session.get_database_session()
    assert next(failed_dependency) is failed_session
    with pytest.raises(RuntimeError, match="operation failed"):
        failed_dependency.throw(RuntimeError("operation failed"))

    failed_session.commit.assert_not_called()
    failed_session.rollback.assert_called_once_with()
    failed_session.close.assert_called_once_with()

    next_dependency = database_session.get_database_session()
    assert next(next_dependency) is next_session
    with pytest.raises(StopIteration):
        next(next_dependency)

    assert factory.call_count == 2
    next_session.commit.assert_called_once_with()
    next_session.rollback.assert_not_called()
    next_session.close.assert_called_once_with()


def test_commit_failure_is_rolled_back_and_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = Mock(spec=Session)
    session.commit.side_effect = RuntimeError("commit failed")
    factory = Mock(return_value=session)
    monkeypatch.setattr(database_session, "get_session_factory", lambda: factory)

    dependency = database_session.get_database_session()
    assert next(dependency) is session
    with pytest.raises(RuntimeError, match="commit failed"):
        next(dependency)

    session.rollback.assert_called_once_with()
    session.close.assert_called_once_with()


def test_database_error_is_sanitized_after_rollback_and_close(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = Mock(spec=Session)
    factory = Mock(return_value=session)
    monkeypatch.setattr(database_session, "get_session_factory", lambda: factory)
    secret_url = "postgresql+psycopg://alice:top-secret@db.internal/memory"

    dependency = database_session.get_database_session()
    assert next(dependency) is session
    with pytest.raises(database_session.DatabaseOperationError) as caught:
        dependency.throw(SQLAlchemyError(secret_url))

    message = str(caught.value)
    assert message == "Database operation failed."
    assert "alice" not in message
    assert "top-secret" not in message
    assert secret_url not in message
    assert caught.value.__cause__ is None
    session.rollback.assert_called_once_with()
    session.close.assert_called_once_with()


def test_session_factory_is_bound_to_the_reused_engine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = Mock(spec=Engine)
    factory = Mock()
    monkeypatch.setattr(database_session, "get_database_engine", lambda: engine)
    monkeypatch.setattr(database_session, "sessionmaker", factory)

    result = database_session.get_session_factory()

    assert result is factory.return_value
    factory.assert_called_once_with(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )
