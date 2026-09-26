from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine, make_url

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
    yield engine
    command.downgrade(config, "base")
    engine.dispose()


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
