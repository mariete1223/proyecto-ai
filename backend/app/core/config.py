from __future__ import annotations

import os

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError

DATABASE_URL_ENV_VAR = "DATABASE_URL"


class DatabaseConfigurationError(RuntimeError):
    """Raised when the database configuration is missing or invalid."""


def load_database_url() -> URL:
    """Load and validate the PostgreSQL URL without exposing its contents."""
    raw_url = os.environ.get(DATABASE_URL_ENV_VAR)

    if raw_url is None or not raw_url.strip():
        raise DatabaseConfigurationError(
            f"{DATABASE_URL_ENV_VAR} is required and must not be empty."
        )

    try:
        url = make_url(raw_url.strip())
        backend_name = url.get_backend_name()
        driver_name = url.get_driver_name()
        _ = url.port
    except (ArgumentError, TypeError, ValueError):
        raise DatabaseConfigurationError(
            f"{DATABASE_URL_ENV_VAR} must be a valid PostgreSQL URL for Psycopg 3."
        ) from None

    if backend_name != "postgresql" or not url.database:
        raise DatabaseConfigurationError(
            f"{DATABASE_URL_ENV_VAR} must be a valid PostgreSQL URL for Psycopg 3."
        )

    if url.drivername == "postgresql":
        return url.set(drivername="postgresql+psycopg")

    if driver_name != "psycopg":
        raise DatabaseConfigurationError(
            f"{DATABASE_URL_ENV_VAR} must use the Psycopg 3 driver."
        )

    return url
