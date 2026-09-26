from __future__ import annotations

from types import TracebackType
from typing import Self, cast

import pytest
from sqlalchemy.engine import Connection, Engine

from scripts.check_database import main


class RecordingConnection:
    def __init__(self) -> None:
        self.statement: str | None = None

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return None

    def execute(self, statement: object) -> None:
        self.statement = str(statement)


class RecordingEngine:
    def __init__(self, connection: RecordingConnection) -> None:
        self.connection = connection

    def connect(self) -> Connection:
        return cast(Connection, self.connection)


def test_database_check_executes_select_one_and_returns_zero(
    capsys: pytest.CaptureFixture[str],
) -> None:
    connection = RecordingConnection()
    engine = cast(Engine, RecordingEngine(connection))

    result = main(lambda: engine)

    assert result == 0
    assert connection.statement == "SELECT 1"
    captured = capsys.readouterr()
    assert captured.out == "PostgreSQL connection check succeeded.\n"
    assert captured.err == ""


def test_database_check_reports_sanitized_configuration_failure(
    capsys: pytest.CaptureFixture[str],
) -> None:
    secret_url = "postgresql+psycopg://alice:top-secret@db.internal/memory"

    def fail() -> Engine:
        raise RuntimeError(secret_url)

    result = main(fail)

    assert result == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == "PostgreSQL connection check failed.\n"
    assert "alice" not in captured.err
    assert "top-secret" not in captured.err
    assert secret_url not in captured.err


def test_database_check_reports_sanitized_connection_failure(
    capsys: pytest.CaptureFixture[str],
) -> None:
    secret_url = "postgresql+psycopg://alice:top-secret@db.internal/memory"

    class FailingEngine:
        def connect(self) -> Connection:
            raise RuntimeError(secret_url)

    result = main(lambda: cast(Engine, FailingEngine()))

    assert result == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == "PostgreSQL connection check failed.\n"
    assert "alice" not in captured.err
    assert "top-secret" not in captured.err
    assert secret_url not in captured.err
