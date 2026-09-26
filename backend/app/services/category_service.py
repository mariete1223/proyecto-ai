from __future__ import annotations

import unicodedata
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import Category
from app.models.enums import CategoryKind
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryNotFoundError(ValueError):
    """Raised when a requested category does not exist for the user."""


class CategoryAlreadyExistsError(ValueError):
    """Raised when a category with duplicate name or voice command exists for the user."""


class InvalidCategoryDataError(ValueError):
    """Raised when category validation fails."""


def normalize_text_key(text_val: str) -> str:
    """Normalize text key using Unicode NFKC, lowercasing, and space collapsing."""
    cleaned = unicodedata.normalize("NFKC", text_val).strip().lower()
    return " ".join(cleaned.split())


def create_category(db: Session, user_id: uuid.UUID, data: CategoryCreate) -> Category:
    """Create a new category for a specific user."""
    name_norm = normalize_text_key(data.name)
    voice_norm = normalize_text_key(data.voice_command)

    if not name_norm:
        raise InvalidCategoryDataError("Category name cannot be empty.")
    if not voice_norm:
        raise InvalidCategoryDataError("Category voice command cannot be empty.")

    stmt_name = select(Category).where(
        Category.user_id == user_id, Category.name_normalized == name_norm
    )
    if db.execute(stmt_name).scalar_one_or_none() is not None:
        raise CategoryAlreadyExistsError("A category with this name already exists.")

    stmt_voice = select(Category).where(
        Category.user_id == user_id, Category.voice_command_normalized == voice_norm
    )
    if db.execute(stmt_voice).scalar_one_or_none() is not None:
        raise CategoryAlreadyExistsError(
            "A category with this voice command already exists."
        )

    if data.kind != CategoryKind.STANDARD:
        stmt_kind = select(Category).where(
            Category.user_id == user_id, Category.kind == data.kind
        )
        if db.execute(stmt_kind).scalar_one_or_none() is not None:
            raise CategoryAlreadyExistsError(
                f"A special category of kind '{data.kind.value}' already exists."
            )

    now = datetime.now(UTC)
    category = Category(
        id=uuid.uuid4(),
        user_id=user_id,
        kind=data.kind,
        name=data.name.strip(),
        name_normalized=name_norm,
        voice_command=data.voice_command.strip(),
        voice_command_normalized=voice_norm,
        description=data.description.strip(),
        color=data.color,
        icon=data.icon.strip(),
        created_at=now,
        updated_at=now,
        version=1,
    )
    db.add(category)
    db.flush()
    return category


def get_category_by_id(
    db: Session, user_id: uuid.UUID, category_id: uuid.UUID
) -> Category:
    """Fetch a user's category by ID or raise CategoryNotFoundError."""
    stmt = select(Category).where(
        Category.id == category_id, Category.user_id == user_id
    )
    category = db.execute(stmt).scalar_one_or_none()
    if category is None:
        raise CategoryNotFoundError("Category not found.")
    return category


def list_categories(db: Session, user_id: uuid.UUID) -> list[Category]:
    """List all categories owned by a user."""
    stmt = (
        select(Category)
        .where(Category.user_id == user_id)
        .order_by(Category.created_at)
    )
    return list(db.execute(stmt).scalars().all())


def update_category(
    db: Session, user_id: uuid.UUID, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    """Update an existing category for a user."""
    category = get_category_by_id(db, user_id, category_id)

    if data.name is not None:
        name_norm = normalize_text_key(data.name)
        if not name_norm:
            raise InvalidCategoryDataError("Category name cannot be empty.")
        if name_norm != category.name_normalized:
            stmt_name = select(Category).where(
                Category.user_id == user_id,
                Category.name_normalized == name_norm,
                Category.id != category_id,
            )
            if db.execute(stmt_name).scalar_one_or_none() is not None:
                raise CategoryAlreadyExistsError(
                    "A category with this name already exists."
                )
            category.name = data.name.strip()
            category.name_normalized = name_norm

    if data.voice_command is not None:
        voice_norm = normalize_text_key(data.voice_command)
        if not voice_norm:
            raise InvalidCategoryDataError("Category voice command cannot be empty.")
        if voice_norm != category.voice_command_normalized:
            stmt_voice = select(Category).where(
                Category.user_id == user_id,
                Category.voice_command_normalized == voice_norm,
                Category.id != category_id,
            )
            if db.execute(stmt_voice).scalar_one_or_none() is not None:
                raise CategoryAlreadyExistsError(
                    "A category with this voice command already exists."
                )
            category.voice_command = data.voice_command.strip()
            category.voice_command_normalized = voice_norm

    if data.description is not None:
        category.description = data.description.strip()
    if data.color is not None:
        category.color = data.color
    if data.icon is not None:
        category.icon = data.icon.strip()

    category.updated_at = datetime.now(UTC)
    category.version += 1
    db.flush()
    return category


def delete_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    """Delete a user's category by ID."""
    category = get_category_by_id(db, user_id, category_id)
    db.delete(category)
    db.flush()
