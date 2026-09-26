from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import load_database_url


class DatabaseOperationError(RuntimeError):
    """A database failure safe to expose without connection details."""


def _rollback(session: Session) -> None:
    try:
        session.rollback()
    except Exception:
        raise DatabaseOperationError("Database operation failed.") from None


@lru_cache(maxsize=1)
def get_database_engine() -> Engine:
    """Build the process-wide engine without opening a database connection."""
    return create_engine(load_database_url(), pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    """Build the process-wide factory used to create isolated sessions."""
    return sessionmaker(
        bind=get_database_engine(),
        autoflush=False,
        expire_on_commit=False,
    )


def get_database_session() -> Generator[Session, None, None]:
    """Yield one transactional session and always finish its lifecycle."""
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except SQLAlchemyError:
        _rollback(session)
        raise DatabaseOperationError("Database operation failed.") from None
    except BaseException:
        _rollback(session)
        raise
    finally:
        try:
            session.close()
        except Exception:
            raise DatabaseOperationError("Database operation failed.") from None
