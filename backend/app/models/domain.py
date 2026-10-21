from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from app.models.base import Base
from app.models.enums import (
    CategoryKind,
    CorrectionField,
    SaveMode,
    TaskPriority,
    TaskRecurrence,
    TaskStatus,
    TombstoneEntity,
)


class GUID(TypeDecorator[Any]):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses String(36).
    """

    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if isinstance(value, UUID):
            return str(value)
        return str(UUID(str(value)))

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return value
        if not isinstance(value, UUID):
            return UUID(str(value))
        return value


UUID_TYPE = GUID()
TIMESTAMP = DateTime(timezone=True)


class JSONType(TypeDecorator[Any]):
    """Portable JSON type: uses JSONB on PostgreSQL, TEXT on SQLite/others."""

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        return json.dumps(value)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        if isinstance(value, str):
            return json.loads(value)
        return value


JSON_TYPE = JSONType()


def enum_type(enum: type[Any], name: str) -> Enum:
    return Enum(enum, name=name, native_enum=False, validate_strings=True)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("char_length(trim(email)) >= 1", name="email_not_blank"),
        CheckConstraint(
            "char_length(trim(email_normalized)) >= 1",
            name="email_normalized_not_blank",
        ),
        CheckConstraint("updated_at >= created_at", name="timestamps_ordered"),
        CheckConstraint("version >= 1", name="version_positive"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    email: Mapped[str] = mapped_column(Text)
    email_normalized: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    version: Mapped[int] = mapped_column(Integer)


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("user_id", "id"),
        UniqueConstraint("user_id", "name_normalized"),
        UniqueConstraint("user_id", "voice_command_normalized"),
        CheckConstraint(
            "char_length(trim(name)) BETWEEN 1 AND 100", name="name_length"
        ),
        CheckConstraint(
            "char_length(trim(name_normalized)) >= 1", name="name_normalized_not_blank"
        ),
        CheckConstraint(
            "char_length(trim(voice_command)) BETWEEN 1 AND 100",
            name="voice_command_length",
        ),
        CheckConstraint(
            "char_length(trim(voice_command_normalized)) >= 1",
            name="voice_command_normalized_not_blank",
        ),
        CheckConstraint(
            "char_length(trim(description)) BETWEEN 1 AND 1000",
            name="description_length",
        ),
        CheckConstraint("length(color) = 7 AND color LIKE '#%'", name="color_format"),
        CheckConstraint(
            "char_length(trim(icon)) BETWEEN 1 AND 100", name="icon_length"
        ),
        CheckConstraint("updated_at >= created_at", name="timestamps_ordered"),
        CheckConstraint("version >= 1", name="version_positive"),
        Index(
            "uq_categories_user_id_special_kind",
            "user_id",
            "kind",
            unique=True,
            postgresql_where=text("kind IN ('EVENT', 'CAPTURE')"),
            sqlite_where=text("kind IN ('EVENT', 'CAPTURE')"),
        ),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    kind: Mapped[CategoryKind] = mapped_column(enum_type(CategoryKind, "category_kind"))
    name: Mapped[str] = mapped_column(String(100))
    name_normalized: Mapped[str] = mapped_column(Text)
    voice_command: Mapped[str] = mapped_column(String(100))
    voice_command_normalized: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(String(1000))
    color: Mapped[str] = mapped_column(String(7))
    icon: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    version: Mapped[int] = mapped_column(Integer)


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("user_id", "id"),
        UniqueConstraint("user_id", "name_normalized"),
        CheckConstraint(
            "char_length(trim(name)) BETWEEN 1 AND 100", name="name_length"
        ),
        CheckConstraint(
            "char_length(trim(name_normalized)) >= 1", name="name_normalized_not_blank"
        ),
        CheckConstraint("updated_at >= created_at", name="timestamps_ordered"),
        CheckConstraint("version >= 1", name="version_positive"),
    )
    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(100))
    name_normalized: Mapped[str] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(7), default="#64748B")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    version: Mapped[int] = mapped_column(Integer)


class Entry(Base):
    __tablename__ = "entries"
    __table_args__ = (
        UniqueConstraint("user_id", "id"),
        UniqueConstraint("user_id", "id", "capture_session_id"),
        ForeignKeyConstraint(
            ["user_id", "category_id"],
            ["categories.user_id", "categories.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "char_length(trim(content)) BETWEEN 1 AND 10000", name="content_length"
        ),
        CheckConstraint(
            "(task_status IS NULL) = (task_recurrence IS NULL)",
            name="task_fields_paired",
        ),
        CheckConstraint(
            "(task_status IS NULL AND task_priority IS NULL) OR (task_status IS NOT NULL)",
            name="task_priority_only_for_tasks",
        ),
        CheckConstraint("updated_at >= created_at", name="timestamps_ordered"),
        CheckConstraint("version >= 1", name="version_positive"),
    )
    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    category_id: Mapped[UUID] = mapped_column(UUID_TYPE)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occurred_at: Mapped[datetime | None] = mapped_column(TIMESTAMP, nullable=True)
    content: Mapped[str] = mapped_column(String(10000))
    task_status: Mapped[TaskStatus | None] = mapped_column(
        enum_type(TaskStatus, "task_status"), nullable=True
    )
    task_priority: Mapped[TaskPriority | None] = mapped_column(
        enum_type(TaskPriority, "task_priority"), nullable=True
    )
    task_recurrence: Mapped[TaskRecurrence | None] = mapped_column(
        enum_type(TaskRecurrence, "task_recurrence"), nullable=True
    )
    capture_session_id: Mapped[UUID | None] = mapped_column(UUID_TYPE, nullable=True)
    reminder_enabled: Mapped[bool | None] = mapped_column(
        Boolean, default=False, nullable=True
    )
    reminder_time: Mapped[datetime | None] = mapped_column(TIMESTAMP, nullable=True)
    reminder_end_time: Mapped[datetime | None] = mapped_column(TIMESTAMP, nullable=True)
    reminder_recurrence: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reminder_offset_minutes: Mapped[int | None] = mapped_column(
        Integer, default=0, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    version: Mapped[int] = mapped_column(Integer)


class EntryTag(Base):
    __tablename__ = "entry_tags"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "entry_id"],
            ["entries.user_id", "entries.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["user_id", "tag_id"], ["tags.user_id", "tags.id"], ondelete="CASCADE"
        ),
        UniqueConstraint("entry_id", "tag_id"),
        CheckConstraint("updated_at = created_at", name="timestamps_equal"),
        CheckConstraint("version = 1", name="version_one"),
    )
    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    entry_id: Mapped[UUID] = mapped_column(UUID_TYPE)
    tag_id: Mapped[UUID] = mapped_column(UUID_TYPE)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    version: Mapped[int] = mapped_column(Integer)


class SavePreference(Base):
    __tablename__ = "save_preferences"
    __table_args__ = (
        CheckConstraint("updated_at >= created_at", name="timestamps_ordered"),
        CheckConstraint("version >= 1", name="version_positive"),
    )
    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), unique=True
    )
    mode: Mapped[SaveMode] = mapped_column(enum_type(SaveMode, "save_mode"))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    version: Mapped[int] = mapped_column(Integer)


class CaptureCorrection(Base):
    __tablename__ = "capture_corrections"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "entry_id", "capture_session_id"],
            ["entries.user_id", "entries.id", "entries.capture_session_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("entry_id", "capture_session_id", "field"),
        CheckConstraint("updated_at = created_at", name="timestamps_equal"),
        CheckConstraint("version = 1", name="version_one"),
    )
    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    entry_id: Mapped[UUID] = mapped_column(UUID_TYPE)
    capture_session_id: Mapped[UUID] = mapped_column(UUID_TYPE)
    field: Mapped[CorrectionField] = mapped_column(
        enum_type(CorrectionField, "correction_field")
    )
    interpreted_value: Mapped[Any | None] = mapped_column(JSON_TYPE, nullable=True)
    accepted_value: Mapped[Any | None] = mapped_column(JSON_TYPE, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    version: Mapped[int] = mapped_column(Integer)


class DeletionTombstone(Base):
    __tablename__ = "deletion_tombstones"
    __table_args__ = (
        UniqueConstraint("user_id", "entity_type", "entity_id"),
        CheckConstraint("deleted_version >= 2", name="deleted_version_minimum"),
    )
    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    entity_type: Mapped[TombstoneEntity] = mapped_column(
        enum_type(TombstoneEntity, "tombstone_entity")
    )
    entity_id: Mapped[UUID] = mapped_column(UUID_TYPE)
    deleted_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    deleted_version: Mapped[int] = mapped_column(Integer)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (
        UniqueConstraint("user_id", "endpoint", name="uq_push_user_endpoint"),
    )
    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    endpoint: Mapped[str] = mapped_column(Text)
    p256dh: Mapped[str] = mapped_column(Text)
    auth: Mapped[str] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
