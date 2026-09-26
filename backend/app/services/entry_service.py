from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.domain import Category, Entry, EntryTag, Tag
from app.models.enums import CategoryKind, TaskRecurrence, TaskStatus
from app.schemas.entry import EntryCreate, EntryUpdate


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

    if category.kind == CategoryKind.TASK:
        if data.task_status is None and data.task_recurrence is None:
            task_status = TaskStatus.PENDING
            task_recurrence = TaskRecurrence.ONCE
        elif data.task_status is not None and data.task_recurrence is not None:
            task_status = data.task_status
            task_recurrence = data.task_recurrence
        else:
            raise InvalidEntryDataError(
                "Task status and task recurrence must both be provided or both omitted."
            )
    else:
        if data.task_status is not None or data.task_recurrence is not None:
            raise InvalidEntryDataError(
                "Task fields can only be set for categories of kind TASK."
            )
        task_status = None
        task_recurrence = None

    distinct_tag_ids = list(dict.fromkeys(data.tag_ids))
    if distinct_tag_ids:
        stmt_tags = select(Tag.id).where(
            Tag.id.in_(distinct_tag_ids), Tag.user_id == user_id
        )
        existing_tag_ids = set(db.execute(stmt_tags).scalars().all())
        if len(existing_tag_ids) != len(distinct_tag_ids):
            raise InvalidEntryDataError("One or more tag IDs do not exist for user.")

    now = datetime.now(UTC)
    occurred_at = data.occurred_at

    entry = Entry(
        id=uuid.uuid4(),
        user_id=user_id,
        category_id=data.category_id,
        occurred_at=occurred_at,
        content=content,
        task_status=task_status,
        task_recurrence=task_recurrence,
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


def list_entries(
    db: Session,
    user_id: uuid.UUID,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    category_ids: list[uuid.UUID] | None = None,
    tag_ids: list[uuid.UUID] | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[tuple[Entry, list[uuid.UUID]]], int]:
    """List and filter entries owned by user with pagination."""
    if page < 1:
        raise InvalidEntryDataError("Page must be greater than or equal to 1.")
    if limit < 1 or limit > 100:
        raise InvalidEntryDataError("Limit must be between 1 and 100.")

    stmt = select(Entry).where(Entry.user_id == user_id)

    if start_at is not None:
        stmt = stmt.where(Entry.occurred_at >= start_at)
    if end_at is not None:
        stmt = stmt.where(Entry.occurred_at <= end_at)
    if category_ids:
        stmt = stmt.where(Entry.category_id.in_(category_ids))
    if tag_ids:
        tag_subquery = select(EntryTag.entry_id).where(
            EntryTag.tag_id.in_(tag_ids), EntryTag.user_id == user_id
        )
        stmt = stmt.where(Entry.id.in_(tag_subquery))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = db.execute(count_stmt).scalar() or 0

    ordered_stmt = stmt.order_by(
        Entry.occurred_at.desc().nulls_last(), Entry.created_at.desc(), Entry.id
    )
    paginated_stmt = ordered_stmt.offset((page - 1) * limit).limit(limit)
    entries = list(db.execute(paginated_stmt).scalars().all())

    results: list[tuple[Entry, list[uuid.UUID]]] = []
    if entries:
        entry_ids = [e.id for e in entries]
        stmt_entry_tags = select(EntryTag.entry_id, EntryTag.tag_id).where(
            EntryTag.entry_id.in_(entry_ids), EntryTag.user_id == user_id
        )
        tag_map: dict[uuid.UUID, list[uuid.UUID]] = {}
        for eid, tid in db.execute(stmt_entry_tags).all():
            tag_map.setdefault(eid, []).append(tid)

        for entry in entries:
            results.append((entry, tag_map.get(entry.id, [])))

    return results, total_count


def list_pending_dateless_tasks(
    db: Session,
    user_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[tuple[Entry, list[uuid.UUID]]], int]:
    """List pending tasks without dates for a user."""
    if page < 1:
        raise InvalidEntryDataError("Page must be greater than or equal to 1.")
    if limit < 1 or limit > 100:
        raise InvalidEntryDataError("Limit must be between 1 and 100.")

    task_cat_subquery = select(Category.id).where(
        Category.kind == CategoryKind.TASK, Category.user_id == user_id
    )

    stmt = select(Entry).where(
        Entry.user_id == user_id,
        Entry.category_id.in_(task_cat_subquery),
        Entry.occurred_at.is_(None),
        Entry.task_status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
    )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_count = db.execute(count_stmt).scalar() or 0

    ordered_stmt = stmt.order_by(Entry.created_at.desc(), Entry.id)
    paginated_stmt = ordered_stmt.offset((page - 1) * limit).limit(limit)
    entries = list(db.execute(paginated_stmt).scalars().all())

    results: list[tuple[Entry, list[uuid.UUID]]] = []
    if entries:
        entry_ids = [e.id for e in entries]
        stmt_entry_tags = select(EntryTag.entry_id, EntryTag.tag_id).where(
            EntryTag.entry_id.in_(entry_ids), EntryTag.user_id == user_id
        )
        tag_map: dict[uuid.UUID, list[uuid.UUID]] = {}
        for eid, tid in db.execute(stmt_entry_tags).all():
            tag_map.setdefault(eid, []).append(tid)

        for entry in entries:
            results.append((entry, tag_map.get(entry.id, [])))

    return results, total_count


def update_entry(
    db: Session, user_id: uuid.UUID, entry_id: uuid.UUID, data: EntryUpdate
) -> tuple[Entry, list[uuid.UUID]]:
    """Update an existing entry and its tags."""
    entry, current_tag_ids = get_entry_by_id(db, user_id, entry_id)
    now = datetime.now(UTC)

    stmt_curr_cat = select(Category).where(
        Category.id == entry.category_id, Category.user_id == user_id
    )
    target_category = db.execute(stmt_curr_cat).scalar_one()

    if data.category_id is not None and data.category_id != entry.category_id:
        stmt_cat = select(Category).where(
            Category.id == data.category_id, Category.user_id == user_id
        )
        target_category_or_none = db.execute(stmt_cat).scalar_one_or_none()
        if target_category_or_none is None:
            raise InvalidEntryDataError(
                "Category not found or does not belong to user."
            )
        target_category = target_category_or_none
        entry.category_id = data.category_id

    if target_category.kind == CategoryKind.TASK:
        new_status = (
            data.task_status if data.task_status is not None else entry.task_status
        )
        new_recurrence = (
            data.task_recurrence
            if data.task_recurrence is not None
            else entry.task_recurrence
        )
        if new_status is None and new_recurrence is None:
            new_status = TaskStatus.PENDING
            new_recurrence = TaskRecurrence.ONCE
        elif new_status is None or new_recurrence is None:
            raise InvalidEntryDataError(
                "Task status and task recurrence must both be paired."
            )
        entry.task_status = new_status
        entry.task_recurrence = new_recurrence
    else:
        if data.task_status is not None or data.task_recurrence is not None:
            raise InvalidEntryDataError(
                "Task fields can only be set for categories of kind TASK."
            )
        entry.task_status = None
        entry.task_recurrence = None

    if data.content is not None:
        cleaned_content = data.content.strip()
        if not cleaned_content:
            raise InvalidEntryDataError("Entry content cannot be empty.")
        entry.content = cleaned_content

    if "occurred_at" in data.model_fields_set:
        entry.occurred_at = data.occurred_at

    updated_tag_ids = current_tag_ids
    if data.tag_ids is not None:
        distinct_tag_ids = list(dict.fromkeys(data.tag_ids))
        if distinct_tag_ids:
            stmt_tags = select(Tag.id).where(
                Tag.id.in_(distinct_tag_ids), Tag.user_id == user_id
            )
            existing_tag_ids = set(db.execute(stmt_tags).scalars().all())
            if len(existing_tag_ids) != len(distinct_tag_ids):
                raise InvalidEntryDataError(
                    "One or more tag IDs do not exist for user."
                )

        db.execute(
            delete(EntryTag).where(
                EntryTag.entry_id == entry_id, EntryTag.user_id == user_id
            )
        )
        for tag_id in distinct_tag_ids:
            db.add(
                EntryTag(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    entry_id=entry.id,
                    tag_id=tag_id,
                    created_at=now,
                    updated_at=now,
                    version=1,
                )
            )
        updated_tag_ids = distinct_tag_ids

    entry.updated_at = now
    entry.version += 1
    db.flush()
    return entry, updated_tag_ids


def update_task_status(
    db: Session, user_id: uuid.UUID, entry_id: uuid.UUID, new_status: TaskStatus
) -> tuple[Entry, list[uuid.UUID]]:
    """Update only the task status of a TASK category entry."""
    entry, tag_ids = get_entry_by_id(db, user_id, entry_id)
    stmt_cat = select(Category).where(
        Category.id == entry.category_id, Category.user_id == user_id
    )
    category = db.execute(stmt_cat).scalar_one()

    if category.kind != CategoryKind.TASK:
        raise InvalidEntryDataError(
            "Task status can only be updated for TASK category entries."
        )

    entry.task_status = new_status
    entry.updated_at = datetime.now(UTC)
    entry.version += 1
    db.flush()
    return entry, tag_ids


def delete_entry(db: Session, user_id: uuid.UUID, entry_id: uuid.UUID) -> None:
    """Delete an entry and its associated EntryTag relationships."""
    entry, _ = get_entry_by_id(db, user_id, entry_id)
    db.execute(
        delete(EntryTag).where(
            EntryTag.entry_id == entry_id, EntryTag.user_id == user_id
        )
    )
    db.delete(entry)
    db.flush()
