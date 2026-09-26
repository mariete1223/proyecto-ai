from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import Category, Entry, EntryTag, Tag
from app.schemas.entry import EntryCreate


class EntryNotFoundError(ValueError):
    """Raised when an entry does not exist for the user."""


class InvalidEntryDataError(ValueError):
    """Raised when entry category or tags are invalid or missing."""


def create_entry(
    db: Session, user_id: uuid.UUID, data: EntryCreate
) -> tuple[Entry, list[uuid.UUID]]:
    """Create a new entry and associate its tags."""
    content = data.content.strip()
    if not content:
        raise InvalidEntryDataError("Entry content cannot be empty.")

    stmt_cat = select(Category).where(
        Category.id == data.category_id, Category.user_id == user_id
    )
    category = db.execute(stmt_cat).scalar_one_or_none()
    if category is None:
        raise InvalidEntryDataError("Category not found or does not belong to user.")

    distinct_tag_ids = list(dict.fromkeys(data.tag_ids))
    if distinct_tag_ids:
        stmt_tags = select(Tag.id).where(
            Tag.id.in_(distinct_tag_ids), Tag.user_id == user_id
        )
        existing_tag_ids = set(db.execute(stmt_tags).scalars().all())
        if len(existing_tag_ids) != len(distinct_tag_ids):
            raise InvalidEntryDataError("One or more tag IDs do not exist for user.")

    now = datetime.now(UTC)
    occurred_at = data.occurred_at if data.occurred_at is not None else now

    entry = Entry(
        id=uuid.uuid4(),
        user_id=user_id,
        category_id=data.category_id,
        occurred_at=occurred_at,
        content=content,
        task_status=None,
        task_recurrence=None,
        capture_session_id=None,
        created_at=now,
        updated_at=now,
        version=1,
    )
    db.add(entry)
    db.flush()

    for tag_id in distinct_tag_ids:
        entry_tag = EntryTag(
            id=uuid.uuid4(),
            user_id=user_id,
            entry_id=entry.id,
            tag_id=tag_id,
            created_at=now,
            updated_at=now,
            version=1,
        )
        db.add(entry_tag)

    db.flush()
    return entry, distinct_tag_ids


def get_entry_by_id(
    db: Session, user_id: uuid.UUID, entry_id: uuid.UUID
) -> tuple[Entry, list[uuid.UUID]]:
    """Fetch an entry and its associated tag IDs by entry ID for a user."""
    stmt_entry = select(Entry).where(Entry.id == entry_id, Entry.user_id == user_id)
    entry = db.execute(stmt_entry).scalar_one_or_none()
    if entry is None:
        raise EntryNotFoundError("Entry not found.")

    stmt_tags = select(EntryTag.tag_id).where(
        EntryTag.entry_id == entry_id, EntryTag.user_id == user_id
    )
    tag_ids = list(db.execute(stmt_tags).scalars().all())
    return entry, tag_ids
