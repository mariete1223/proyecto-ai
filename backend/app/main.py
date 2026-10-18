import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

os.environ["DISABLE_SQLALCHEMY_CEXT"] = "1"

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_v1_router
from app.db.session import get_database_engine
from app.models import (
    domain as _models_domain,  # noqa: F401 – registers all model classes with Base.metadata
)
from app.models.base import Base
from app.services.push_worker import run_reminder_push_loop


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create tables on startup (for dev SQLite; migrations handle PostgreSQL) and start push worker."""
    engine = get_database_engine()
    if engine.url.drivername.startswith("sqlite"):
        _create_sqlite_tables(engine)
    worker_task = asyncio.create_task(run_reminder_push_loop(interval_seconds=30))
    try:
        yield
    finally:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


def _create_sqlite_tables(engine: Any) -> None:
    """Create SQLite tables without PostgreSQL-specific CHECK constraints."""
    from sqlalchemy.schema import CheckConstraint as SACheck

    tables = Base.metadata.sorted_tables
    with engine.begin() as conn:
        for table in tables:
            checks_backup = [c for c in table.constraints if isinstance(c, SACheck)]
            for c in checks_backup:
                table.constraints.discard(c)
            try:
                table.create(bind=conn, checkfirst=True)
            finally:
                for c in checks_backup:
                    table.constraints.add(c)
        # Ensure newer columns exist in dev SQLite if tables already existed
        for alter_stmt in [
            "ALTER TABLE tags ADD COLUMN color VARCHAR(7) DEFAULT '#64748B';",
            "ALTER TABLE entries ADD COLUMN title TEXT;",
            "ALTER TABLE entries ADD COLUMN task_priority VARCHAR(20);",
            "ALTER TABLE entries ADD COLUMN reminder_enabled BOOLEAN DEFAULT 0;",
            "ALTER TABLE entries ADD COLUMN reminder_time TIMESTAMP;",
            "ALTER TABLE entries ADD COLUMN reminder_end_time TIMESTAMP;",
            "ALTER TABLE entries ADD COLUMN reminder_recurrence VARCHAR(20);",
            "ALTER TABLE entries ADD COLUMN reminder_offset_minutes INTEGER DEFAULT 0;",
        ]:
            try:
                conn.exec_driver_sql(alter_stmt)
            except Exception:
                pass


app = FastAPI(title="Proyecto AI API", version="0.1.0", lifespan=lifespan)

allowed_origins_env = os.environ.get("ALLOWED_ORIGINS")
if allowed_origins_env and allowed_origins_env.strip():
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
