from __future__ import annotations

import sys
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db.session import get_database_engine


def main(engine_factory: Callable[[], Engine] = get_database_engine) -> int:
    """Run a minimal database query without exposing connection details."""
    try:
        engine = engine_factory()
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        print("PostgreSQL connection check failed.", file=sys.stderr)
        return 1

    print("PostgreSQL connection check succeeded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
