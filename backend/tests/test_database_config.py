from __future__ import annotations

import pytest

from app.core.config import DatabaseConfigurationError, load_database_url


@pytest.mark.parametrize(
    "environ",
    ({}, {"DATABASE_URL": ""}, {"DATABASE_URL": "   "}),
)
def test_database_url_is_required(
    environ: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    for key, value in environ.items():
        monkeypatch.setenv(key, value)

    with pytest.raises(DatabaseConfigurationError, match="DATABASE_URL"):
        load_database_url()


@pytest.mark.parametrize(
    "raw_url",
    (
        "not a url",
        "sqlite:///local.db",
        "postgresql+psycopg://localhost",
        "postgresql+psycopg2://user:secret@localhost/database",
        "postgresql+asyncpg://user:secret@localhost/database",
        "postgresql+psycopg://user:secret@localhost:not-a-port/database",
    ),
)
def test_database_url_rejects_invalid_values_without_leaking_them(
    raw_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", raw_url)

    with pytest.raises(DatabaseConfigurationError) as caught:
        load_database_url()

    message = str(caught.value)
    assert "DATABASE_URL" in message
    assert raw_url not in message
    assert "user" not in message
    assert "secret" not in message


def test_plain_postgresql_url_is_configured_for_psycopg_3(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql://alice:secret@db.internal:5432/memory"
    )

    url = load_database_url()

    assert url.drivername == "postgresql+psycopg"
    assert url.username == "alice"
    assert url.password == "secret"
    assert url.host == "db.internal"
    assert url.port == 5432
    assert url.database == "memory"


def test_explicit_psycopg_url_is_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://alice:secret@localhost/memory",
    )

    url = load_database_url()

    assert url.drivername == "postgresql+psycopg"


def test_database_url_is_read_from_the_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://alice:secret@localhost/memory"
    )

    assert load_database_url().database == "memory"
