from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any, cast

import pytest
from sqlalchemy import Table, create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.domain import (
    CaptureCorrection,
    Category,
    DeletionTombstone,
    Entry,
    EntryTag,
    SavePreference,
    Tag,
    User,
)
from app.models.enums import CategoryKind, TombstoneEntity
from app.schemas.sync import SyncAction, SyncClientChange
from app.services.category_service import CANONICAL_CATEGORY_IDS
from app.services.sync_service import _resolve_category_id_for_user, process_sync_push


@pytest.fixture
def memory_db() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def register_sqlite_functions(dbapi_connection: Any, connection_record: Any) -> None:
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
        tables=[
            cast(Table, User.__table__),
            cast(Table, Category.__table__),
            cast(Table, Tag.__table__),
            cast(Table, Entry.__table__),
            cast(Table, EntryTag.__table__),
            cast(Table, SavePreference.__table__),
            cast(Table, CaptureCorrection.__table__),
            cast(Table, DeletionTombstone.__table__),
        ],
    )
    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_sync_push_resolves_canonical_eventos_to_legacy_category(memory_db: Session) -> None:
    now = datetime.now(UTC)
    # Another user already owns canonical EVENTOS ID
    other_user = User(
        id=uuid.uuid4(),
        email="other@example.com",
        email_normalized="other@example.com",
        password_hash="hash",
        is_verified=True,
        created_at=now,
        updated_at=now,
        version=1,
    )
    memory_db.add(other_user)
    cat_other_eventos = Category(
        id=CANONICAL_CATEGORY_IDS["eventos"],
        user_id=other_user.id,
        kind=CategoryKind.EVENT,
        name="Evento",
        name_normalized="evento",
        voice_command="evento",
        voice_command_normalized="evento",
        description="Eventos",
        color="#1E88E5",
        icon="calendar",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        updated_at=datetime(2026, 1, 1, tzinfo=UTC),
        version=1,
    )
    memory_db.add(cat_other_eventos)

    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        email_normalized="test@example.com",
        password_hash="hash",
        is_verified=True,
        created_at=now,
        updated_at=now,
        version=1,
    )
    memory_db.add(user)

    # Legacy Alerta created first (oldest category in DB)
    alerta_legacy_id = uuid.uuid4()
    cat_alerta = Category(
        id=alerta_legacy_id,
        user_id=user.id,
        kind=CategoryKind.STANDARD,
        name="Alerta",
        name_normalized="alerta",
        voice_command="alerta",
        voice_command_normalized="alerta",
        description="Alertas",
        color="#EF4444",
        icon="bell",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        updated_at=datetime(2026, 1, 1, tzinfo=UTC),
        version=1,
    )
    memory_db.add(cat_alerta)

    # Legacy Eventos category with a non-canonical random UUID
    eventos_legacy_id = uuid.uuid4()
    cat_eventos = Category(
        id=eventos_legacy_id,
        user_id=user.id,
        kind=CategoryKind.EVENT,
        name="Eventos",
        name_normalized="eventos",
        voice_command="evento",
        voice_command_normalized="evento",
        description="Eventos de calendario",
        color="#1E88E5",
        icon="calendar",
        created_at=datetime(2026, 1, 2, tzinfo=UTC),
        updated_at=datetime(2026, 1, 2, tzinfo=UTC),
        version=1,
    )
    memory_db.add(cat_eventos)
    memory_db.commit()

    # The client sends an entry with canonical EVENTOS ID
    canonical_eventos_id = CANONICAL_CATEGORY_IDS["eventos"]
    assert canonical_eventos_id != eventos_legacy_id

    entry_id = uuid.uuid4()
    change = SyncClientChange(
        change_id=uuid.uuid4(),
        entity_type=TombstoneEntity.ENTRY,
        entity_id=entry_id,
        action=SyncAction.CREATE,
        base_version=0,
        payload={
            "id": str(entry_id),
            "category_id": str(canonical_eventos_id),
            "title": "Cita médica",
            "content": "evento Consulta con el traumatólogo",
            "occurred_at": datetime(2026, 11, 10, 10, 0, tzinfo=UTC).isoformat(),
        },
    )

    results = process_sync_push(memory_db, user.id, [change])
    assert len(results) == 1
    assert results[0].status.value == "APPLIED"

    saved_entry = memory_db.execute(select(Entry).where(Entry.id == entry_id)).scalar_one()
    # It must NOT have mutated to Alerta!
    assert saved_entry.category_id != alerta_legacy_id
    # It must resolve to the user's Eventos category
    assert saved_entry.category_id == eventos_legacy_id


def test_sync_push_unknown_category_falls_back_to_neutral_not_alerta(memory_db: Session) -> None:
    now = datetime.now(UTC)
    # Other user owns canonical NOTAS ID
    other_user = User(
        id=uuid.uuid4(),
        email="other2@example.com",
        email_normalized="other2@example.com",
        password_hash="hash",
        is_verified=True,
        created_at=now,
        updated_at=now,
        version=1,
    )
    memory_db.add(other_user)
    cat_other_notas = Category(
        id=CANONICAL_CATEGORY_IDS["notas"],
        user_id=other_user.id,
        kind=CategoryKind.STANDARD,
        name="Notas",
        name_normalized="notas",
        voice_command="nota",
        voice_command_normalized="nota",
        description="Notas",
        color="#6366F1",
        icon="book",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        updated_at=datetime(2026, 1, 1, tzinfo=UTC),
        version=1,
    )
    memory_db.add(cat_other_notas)

    user = User(
        id=uuid.uuid4(),
        email="test2@example.com",
        email_normalized="test2@example.com",
        password_hash="hash",
        is_verified=True,
        created_at=now,
        updated_at=now,
        version=1,
    )
    memory_db.add(user)

    # Alerta created first
    cat_alerta = Category(
        id=uuid.uuid4(),
        user_id=user.id,
        kind=CategoryKind.STANDARD,
        name="Alerta",
        name_normalized="alerta",
        voice_command="alerta",
        voice_command_normalized="alerta",
        description="Alertas",
        color="#EF4444",
        icon="bell",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        updated_at=datetime(2026, 1, 1, tzinfo=UTC),
        version=1,
    )
    memory_db.add(cat_alerta)

    # Notas created second with legacy UUID
    notas_legacy_id = uuid.uuid4()
    cat_notas = Category(
        id=notas_legacy_id,
        user_id=user.id,
        kind=CategoryKind.STANDARD,
        name="Notas",
        name_normalized="notas",
        voice_command="nota",
        voice_command_normalized="nota",
        description="Notas generales",
        color="#6366F1",
        icon="book",
        created_at=datetime(2026, 1, 2, tzinfo=UTC),
        updated_at=datetime(2026, 1, 2, tzinfo=UTC),
        version=1,
    )
    memory_db.add(cat_notas)
    memory_db.commit()

    # Completely unknown UUID passed
    unknown_uuid = uuid.uuid4()
    entry_id = uuid.uuid4()
    change = SyncClientChange(
        change_id=uuid.uuid4(),
        entity_type=TombstoneEntity.ENTRY,
        entity_id=entry_id,
        action=SyncAction.CREATE,
        base_version=0,
        payload={
            "id": str(entry_id),
            "category_id": str(unknown_uuid),
            "content": "Nota sin categoría clara",
        },
    )

    results = process_sync_push(memory_db, user.id, [change])
    assert len(results) == 1
    assert results[0].status.value == "APPLIED"

    saved_entry = memory_db.execute(select(Entry).where(Entry.id == entry_id)).scalar_one()
    # It must fall back to Notas, NOT Alerta!
    assert saved_entry.category_id == notas_legacy_id
    assert saved_entry.category_id != cat_alerta.id
