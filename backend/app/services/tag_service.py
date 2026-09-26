from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import Tag
from app.schemas.tag import TagCreate, TagUpdate


class TagNotFoundError(ValueError):
    """Raised when a requested tag does not exist for the user."""


class TagAlreadyExistsError(ValueError):
    """Raised when a tag with a duplicate normalized name exists for the user."""


class InvalidTagDataError(ValueError):
    """Raised when tag validation fails."""


def normalize_tag_name(name: str) -> str:
    """Normalize tag name by NFKC, lowercasing, stripping, and collapsing _, -, and spaces."""
    cleaned = unicodedata.normalize("NFKC", name).strip().lower()
    cleaned = re.sub(r"[_\-\s]+", " ", cleaned)
    return cleaned.strip()


def create_tag(db: Session, user_id: uuid.UUID, data: TagCreate) -> Tag:
    """Create a new tag for a user."""
    norm_name = normalize_tag_name(data.name)
    if not norm_name:
        raise InvalidTagDataError("Tag name cannot be empty.")

    stmt = select(Tag).where(Tag.user_id == user_id, Tag.name_normalized == norm_name)
    if db.execute(stmt).scalar_one_or_none() is not None:
        raise TagAlreadyExistsError("A tag with this name already exists.")

    now = datetime.now(UTC)
    tag = Tag(
        id=uuid.uuid4(),
        user_id=user_id,
        name=data.name.strip(),
        name_normalized=norm_name,
        created_at=now,
        updated_at=now,
        version=1,
    )
    db.add(tag)
    db.flush()
    return tag


def get_tag_by_id(db: Session, user_id: uuid.UUID, tag_id: uuid.UUID) -> Tag:
    """Get a user's tag by ID or raise TagNotFoundError."""
    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id)
    tag = db.execute(stmt).scalar_one_or_none()
    if tag is None:
        raise TagNotFoundError("Tag not found.")
    return tag


def list_tags(db: Session, user_id: uuid.UUID) -> list[Tag]:
    """List all tags owned by a user ordered by name."""
    stmt = select(Tag).where(Tag.user_id == user_id).order_by(Tag.name)
    return list(db.execute(stmt).scalars().all())


def update_tag(
    db: Session, user_id: uuid.UUID, tag_id: uuid.UUID, data: TagUpdate
) -> Tag:
    """Update a user's tag."""
    tag = get_tag_by_id(db, user_id, tag_id)
    norm_name = normalize_tag_name(data.name)
    if not norm_name:
        raise InvalidTagDataError("Tag name cannot be empty.")

    if norm_name != tag.name_normalized:
        stmt = select(Tag).where(
            Tag.user_id == user_id, Tag.name_normalized == norm_name, Tag.id != tag_id
        )
        if db.execute(stmt).scalar_one_or_none() is not None:
            raise TagAlreadyExistsError("A tag with this name already exists.")

        tag.name = data.name.strip()
        tag.name_normalized = norm_name

    tag.updated_at = datetime.now(UTC)
    tag.version += 1
    db.flush()
    return tag


def delete_tag(db: Session, user_id: uuid.UUID, tag_id: uuid.UUID) -> None:
    """Delete a user's tag."""
    tag = get_tag_by_id(db, user_id, tag_id)
    db.delete(tag)
    db.flush()
