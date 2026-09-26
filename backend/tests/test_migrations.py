from __future__ import annotations

# mypy: disable-error-code="attr-defined"
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Connection, Engine, make_url
from sqlalchemy.exc import DBAPIError

from app.models import (
    CaptureCorrection,
    Category,
    CategoryKind,
    CorrectionField,
    DeletionTombstone,
    Entry,
    EntryTag,
    SaveMode,
    SavePreference,
    Tag,
    TaskRecurrence,
    TaskStatus,
    TombstoneEntity,
    User,
)

DOMAIN_TABLES = {
    "users",
    "categories",
    "tags",
    "entries",
    "entry_tags",
    "save_preferences",
    "capture_corrections",
    "deletion_tombstones",
}
ENUM_TYPES = {
    "category_kind",
    "task_status",
    "task_recurrence",
    "save_mode",
    "correction_field",
    "tombstone_entity",
}


def require_test_database_url(raw_url: str) -> str:
    url = make_url(raw_url)
    database = (url.database or "").lower()
    if "test" not in database:
        raise RuntimeError("Migration tests require an explicitly named test database.")
    return raw_url


def assert_rejected(connection: Connection, statement: Any) -> None:
    with pytest.raises(DBAPIError):
        with connection.begin_nested():
            connection.execute(statement)


def seed_domain_graph(connection: Connection) -> dict[str, Any]:
    now = datetime.now(UTC)
    ids: dict[str, Any] = {
        name: uuid4()
        for name in (
            "user1",
            "user2",
            "category1",
            "category2",
            "tag1",
            "tag2",
            "entry1",
            "entry2",
            "session1",
        )
    }
    for key in ("user1", "user2"):
        connection.execute(
            User.__table__.insert(),
            {
                "id": ids[key],
                "email": f"{key}@example.com",
                "email_normalized": f"{key}@example.com",
                "password_hash": "hash",
                "created_at": now,
                "updated_at": now,
                "version": 1,
            },
        )
    for number in (1, 2):
        connection.execute(
            Category.__table__.insert(),
            {
                "id": ids[f"category{number}"],
                "user_id": ids[f"user{number}"],
                "kind": CategoryKind.TASK,
                "name": f"Task {number}",
                "name_normalized": f"task {number}",
                "voice_command": f"task {number}",
                "voice_command_normalized": f"task {number}",
                "description": "Tasks",
                "color": "#ABCDEF",
                "icon": "check",
                "created_at": now,
                "updated_at": now,
                "version": 1,
            },
        )
        connection.execute(
            Tag.__table__.insert(),
            {
                "id": ids[f"tag{number}"],
                "user_id": ids[f"user{number}"],
                "name": f"Tag {number}",
                "name_normalized": f"tag {number}",
                "created_at": now,
                "updated_at": now,
                "version": 1,
            },
        )
        connection.execute(
            Entry.__table__.insert(),
            {
                "id": ids[f"entry{number}"],
                "user_id": ids[f"user{number}"],
                "category_id": ids[f"category{number}"],
                "occurred_at": None,
                "content": f"Task {number}",
                "task_status": TaskStatus.PENDING,
                "task_recurrence": TaskRecurrence.ONCE,
                "capture_session_id": ids["session1"] if number == 1 else uuid4(),
                "created_at": now,
                "updated_at": now,
                "version": 1,
            },
        )
    ids["now"] = now
    return ids


@pytest.fixture(scope="module")
def migrated_database() -> Iterator[Engine]:
    raw_url = os.environ.get("DATABASE_URL")
    if raw_url is None:
        pytest.skip("DATABASE_URL is not configured for PostgreSQL integration tests")
    safe_url = require_test_database_url(raw_url)
    config = Config("alembic.ini")
    engine = create_engine(safe_url)

    command.downgrade(config, "base")
    with engine.connect() as connection:
        existing = set(inspect(connection).get_table_names()) - {"alembic_version"}
        assert not existing
        enum_names: set[str] = set(
            connection.execute(
                text("SELECT typname FROM pg_type WHERE typname = ANY(:names)"),
                {"names": sorted(ENUM_TYPES)},
            ).scalars()
        )
        assert not enum_names

    command.upgrade(config, "head")
    command.upgrade(config, "head")
    command.check(config)
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    command.check(config)
    yield engine
    command.downgrade(config, "base")
    engine.dispose()


@pytest.fixture
def database_connection(migrated_database: Engine) -> Iterator[Connection]:
    with migrated_database.connect() as connection:
        transaction = connection.begin()
        try:
            yield connection
        finally:
            transaction.rollback()


def test_test_database_guard_rejects_non_test_database() -> None:
    with pytest.raises(RuntimeError, match="test database"):
        require_test_database_url("postgresql+psycopg://user:secret@localhost/app")


def test_initial_revision_matches_domain_schema(migrated_database: Engine) -> None:
    inspector = inspect(migrated_database)
    assert set(inspector.get_table_names()) == DOMAIN_TABLES | {"alembic_version"}

    expected_unique = {
        "users": {"uq_users_email_normalized"},
        "categories": {
            "uq_categories_user_id_id",
            "uq_categories_user_id_name_normalized",
            "uq_categories_user_id_voice_command_normalized",
        },
        "tags": {"uq_tags_user_id_id", "uq_tags_user_id_name_normalized"},
        "entries": {
            "uq_entries_user_id_id",
            "uq_entries_user_id_id_capture_session_id",
        },
        "entry_tags": {"uq_entry_tags_entry_id_tag_id"},
        "save_preferences": {"uq_save_preferences_user_id"},
        "capture_corrections": {
            "uq_capture_corrections_entry_id_capture_session_id_field"
        },
        "deletion_tombstones": {"uq_deletion_tombstones_user_id_entity_type_entity_id"},
    }
    for table, names in expected_unique.items():
        actual = {item["name"] for item in inspector.get_unique_constraints(table)}
        assert names <= actual

    indexes = {item["name"]: item for item in inspector.get_indexes("categories")}
    assert indexes["uq_categories_user_id_special_kind"]["unique"] is True
    assert "STANDARD" in str(
        indexes["uq_categories_user_id_special_kind"]["dialect_options"]
    )

    expected_checks = {
        "ck_users_email_not_blank",
        "ck_users_email_normalized_not_blank",
        "ck_users_timestamps_ordered",
        "ck_users_version_positive",
        "ck_categories_color_format",
        "ck_categories_description_length",
        "ck_categories_icon_length",
        "ck_categories_name_length",
        "ck_categories_name_normalized_not_blank",
        "ck_categories_timestamps_ordered",
        "ck_categories_version_positive",
        "ck_categories_voice_command_length",
        "ck_categories_voice_command_normalized_not_blank",
        "ck_tags_name_length",
        "ck_tags_name_normalized_not_blank",
        "ck_tags_timestamps_ordered",
        "ck_tags_version_positive",
        "ck_entries_content_length",
        "ck_entries_task_fields_paired",
        "ck_entries_timestamps_ordered",
        "ck_entries_version_positive",
        "ck_entry_tags_timestamps_equal",
        "ck_entry_tags_version_one",
        "ck_save_preferences_timestamps_ordered",
        "ck_save_preferences_version_positive",
        "ck_capture_corrections_timestamps_equal",
        "ck_capture_corrections_version_one",
        "ck_deletion_tombstones_deleted_version_minimum",
    }
    actual_checks = {
        item["name"]
        for table in DOMAIN_TABLES
        for item in inspector.get_check_constraints(table)
    }
    assert expected_checks <= actual_checks

    with migrated_database.connect() as connection:
        actual_enums: set[str] = set(
            connection.execute(
                text("SELECT typname FROM pg_type WHERE typname = ANY(:names)"),
                {"names": sorted(ENUM_TYPES)},
            ).scalars()
        )
    assert actual_enums == ENUM_TYPES


def test_foreign_keys_enforce_ownership_and_delete_actions(
    migrated_database: Engine,
) -> None:
    inspector = inspect(migrated_database)

    def foreign_keys(table: str) -> dict[tuple[str, ...], tuple[tuple[str, ...], str]]:
        return {
            tuple(item["constrained_columns"]): (
                tuple(item["referred_columns"]),
                item["options"]["ondelete"],
            )
            for item in inspector.get_foreign_keys(table)
        }

    assert foreign_keys("entries")[("user_id", "category_id")] == (
        ("user_id", "id"),
        "RESTRICT",
    )
    assert foreign_keys("entry_tags")[("user_id", "entry_id")] == (
        ("user_id", "id"),
        "CASCADE",
    )
    assert foreign_keys("entry_tags")[("user_id", "tag_id")] == (
        ("user_id", "id"),
        "CASCADE",
    )
    assert foreign_keys("capture_corrections")[
        ("user_id", "entry_id", "capture_session_id")
    ] == (("user_id", "id", "capture_session_id"), "CASCADE")

    for table in DOMAIN_TABLES - {"users"}:
        assert foreign_keys(table)[("user_id",)][1] == "RESTRICT"


def test_postgresql_enforces_every_uniqueness_family(
    database_connection: Connection,
) -> None:
    connection = database_connection
    data = seed_domain_graph(connection)
    with connection.begin_nested():
        now = data["now"]
        common = {"created_at": now, "updated_at": now, "version": 1}

        assert_rejected(
            connection,
            User.__table__.insert().values(
                id=uuid4(),
                email="duplicate@example.com",
                email_normalized="user1@example.com",
                password_hash="hash",
                **common,
            ),
        )
        base_category = {
            "user_id": data["user1"],
            "kind": CategoryKind.STANDARD,
            "description": "Description",
            "color": "#123ABC",
            "icon": "circle",
            **common,
        }
        connection.execute(
            Category.__table__.insert().values(
                id=uuid4(),
                name="Alpha",
                name_normalized="alpha",
                voice_command="alpha",
                voice_command_normalized="alpha",
                **base_category,
            )
        )
        assert_rejected(
            connection,
            Category.__table__.insert().values(
                id=uuid4(),
                name="Alpha 2",
                name_normalized="alpha",
                voice_command="alpha 2",
                voice_command_normalized="alpha 2",
                **base_category,
            ),
        )
        assert_rejected(
            connection,
            Category.__table__.insert().values(
                id=uuid4(),
                name="Beta",
                name_normalized="beta",
                voice_command="Beta",
                voice_command_normalized="alpha",
                **base_category,
            ),
        )
        assert_rejected(
            connection,
            Category.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                kind=CategoryKind.TASK,
                name="Other task",
                name_normalized="other task",
                voice_command="other task",
                voice_command_normalized="other task",
                description="Tasks",
                color="#123ABC",
                icon="check",
                **common,
            ),
        )
        assert_rejected(
            connection,
            Tag.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                name="Duplicate",
                name_normalized="tag 1",
                **common,
            ),
        )

        relation = {
            "id": uuid4(),
            "user_id": data["user1"],
            "entry_id": data["entry1"],
            "tag_id": data["tag1"],
            **common,
        }
        connection.execute(EntryTag.__table__.insert().values(**relation))
        assert_rejected(
            connection,
            EntryTag.__table__.insert().values(**(relation | {"id": uuid4()})),
        )
        preference = {
            "id": uuid4(),
            "user_id": data["user1"],
            "mode": SaveMode.FAST_FORWARD,
            **common,
        }
        connection.execute(SavePreference.__table__.insert().values(**preference))
        assert_rejected(
            connection,
            SavePreference.__table__.insert().values(**(preference | {"id": uuid4()})),
        )
        correction = {
            "id": uuid4(),
            "user_id": data["user1"],
            "entry_id": data["entry1"],
            "capture_session_id": data["session1"],
            "field": CorrectionField.CONTENT,
            "interpreted_value": "old",
            "accepted_value": "new",
            **common,
        }
        connection.execute(CaptureCorrection.__table__.insert().values(**correction))
        assert_rejected(
            connection,
            CaptureCorrection.__table__.insert().values(
                **(correction | {"id": uuid4()})
            ),
        )
        tombstone = {
            "id": uuid4(),
            "user_id": data["user1"],
            "entity_type": TombstoneEntity.TAG,
            "entity_id": uuid4(),
            "deleted_at": now,
            "deleted_version": 2,
        }
        connection.execute(DeletionTombstone.__table__.insert().values(**tombstone))
        assert_rejected(
            connection,
            DeletionTombstone.__table__.insert().values(
                **(tombstone | {"id": uuid4()})
            ),
        )


def test_postgresql_enforces_every_check_family(
    database_connection: Connection,
) -> None:
    connection = database_connection
    data = seed_domain_graph(connection)
    with connection.begin_nested():
        now = data["now"]
        cases = [
            User.__table__.update().where(User.id == data["user1"]).values(email="   "),
            User.__table__.update()
            .where(User.id == data["user1"])
            .values(email_normalized=""),
            User.__table__.update()
            .where(User.id == data["user1"])
            .values(updated_at=now - timedelta(seconds=1)),
            User.__table__.update().where(User.id == data["user1"]).values(version=0),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(name=" "),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(name="x" * 101),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(name_normalized=""),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(voice_command=""),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(voice_command="x" * 101),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(voice_command_normalized=""),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(description="x" * 1001),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(color="#abcdef"),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(icon="x" * 101),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(updated_at=now - timedelta(seconds=1)),
            Category.__table__.update()
            .where(Category.id == data["category1"])
            .values(version=0),
            Tag.__table__.update().where(Tag.id == data["tag1"]).values(name=""),
            Tag.__table__.update()
            .where(Tag.id == data["tag1"])
            .values(name_normalized=""),
            Tag.__table__.update()
            .where(Tag.id == data["tag1"])
            .values(updated_at=now - timedelta(seconds=1)),
            Tag.__table__.update().where(Tag.id == data["tag1"]).values(version=0),
            Entry.__table__.update()
            .where(Entry.id == data["entry1"])
            .values(content="x" * 10001),
            Entry.__table__.update()
            .where(Entry.id == data["entry1"])
            .values(task_status=None),
            Entry.__table__.update()
            .where(Entry.id == data["entry1"])
            .values(updated_at=now - timedelta(seconds=1)),
            Entry.__table__.update()
            .where(Entry.id == data["entry1"])
            .values(version=0),
        ]
        for statement in cases:
            assert_rejected(connection, statement)

        immutable_rows = [
            EntryTag.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                entry_id=data["entry1"],
                tag_id=data["tag1"],
                created_at=now,
                updated_at=now + timedelta(seconds=1),
                version=1,
            ),
            EntryTag.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                entry_id=data["entry1"],
                tag_id=data["tag1"],
                created_at=now,
                updated_at=now,
                version=2,
            ),
            CaptureCorrection.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                entry_id=data["entry1"],
                capture_session_id=data["session1"],
                field=CorrectionField.CONTENT,
                interpreted_value=None,
                accepted_value="x",
                created_at=now,
                updated_at=now + timedelta(seconds=1),
                version=1,
            ),
            CaptureCorrection.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                entry_id=data["entry1"],
                capture_session_id=data["session1"],
                field=CorrectionField.CONTENT,
                interpreted_value=None,
                accepted_value="x",
                created_at=now,
                updated_at=now,
                version=2,
            ),
            SavePreference.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                mode=SaveMode.FAST_FORWARD,
                created_at=now,
                updated_at=now - timedelta(seconds=1),
                version=1,
            ),
            SavePreference.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                mode=SaveMode.FAST_FORWARD,
                created_at=now,
                updated_at=now,
                version=0,
            ),
            DeletionTombstone.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                entity_type=TombstoneEntity.TAG,
                entity_id=uuid4(),
                deleted_at=now,
                deleted_version=1,
            ),
        ]
        for statement in immutable_rows:
            assert_rejected(connection, statement)


def test_postgresql_enforces_owner_isolation_and_delete_behavior(
    database_connection: Connection,
) -> None:
    connection = database_connection
    data = seed_domain_graph(connection)
    with connection.begin_nested():
        now = data["now"]
        assert_rejected(
            connection,
            Entry.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                category_id=data["category2"],
                content="Wrong owner",
                task_status=TaskStatus.PENDING,
                task_recurrence=TaskRecurrence.ONCE,
                capture_session_id=None,
                occurred_at=None,
                created_at=now,
                updated_at=now,
                version=1,
            ),
        )
        for entry_id, tag_id in (
            (data["entry2"], data["tag1"]),
            (data["entry1"], data["tag2"]),
        ):
            assert_rejected(
                connection,
                EntryTag.__table__.insert().values(
                    id=uuid4(),
                    user_id=data["user1"],
                    entry_id=entry_id,
                    tag_id=tag_id,
                    created_at=now,
                    updated_at=now,
                    version=1,
                ),
            )
        assert_rejected(
            connection,
            CaptureCorrection.__table__.insert().values(
                id=uuid4(),
                user_id=data["user2"],
                entry_id=data["entry1"],
                capture_session_id=data["session1"],
                field=CorrectionField.CONTENT,
                interpreted_value=None,
                accepted_value="x",
                created_at=now,
                updated_at=now,
                version=1,
            ),
        )
        assert_rejected(
            connection,
            Tag.__table__.insert().values(
                id=uuid4(),
                user_id=uuid4(),
                name="Orphan",
                name_normalized="orphan",
                created_at=now,
                updated_at=now,
                version=1,
            ),
        )

        connection.execute(
            EntryTag.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                entry_id=data["entry1"],
                tag_id=data["tag1"],
                created_at=now,
                updated_at=now,
                version=1,
            )
        )
        connection.execute(
            CaptureCorrection.__table__.insert().values(
                id=uuid4(),
                user_id=data["user1"],
                entry_id=data["entry1"],
                capture_session_id=data["session1"],
                field=CorrectionField.CONTENT,
                interpreted_value=None,
                accepted_value="x",
                created_at=now,
                updated_at=now,
                version=1,
            )
        )
        assert_rejected(
            connection,
            Category.__table__.delete().where(Category.id == data["category1"]),
        )
        assert_rejected(
            connection, User.__table__.delete().where(User.id == data["user1"])
        )

        connection.execute(Tag.__table__.delete().where(Tag.id == data["tag1"]))
        assert (
            connection.scalar(
                text("SELECT count(*) FROM entry_tags WHERE entry_id=:id"),
                {"id": data["entry1"]},
            )
            == 0
        )
        connection.execute(Entry.__table__.delete().where(Entry.id == data["entry1"]))
        assert (
            connection.scalar(
                text("SELECT count(*) FROM capture_corrections WHERE entry_id=:id"),
                {"id": data["entry1"]},
            )
            == 0
        )
