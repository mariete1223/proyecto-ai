from __future__ import annotations

import unicodedata
import uuid
from datetime import UTC, datetime
from typing import Any

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


class ProtectedCategoryError(ValueError):
    """Raised when attempting to delete a system protected category."""


PROTECTED_SYSTEM_CATEGORY_NAMES: set[str] = {
    "nota",
    "notas",
    "tarea",
    "tareas",
    "evento",
    "eventos",
    "alerta",
    "alertas",
}


INITIAL_CATEGORIES: list[dict[str, Any]] = [
    {
        "kind": CategoryKind.TASK,
        "name": "Tarea",
        "voice_command": "tarea",
        "description": "Categoría predeterminada para tareas y cosas pendientes",
        "color": "#E53935",
        "icon": "check-square",
    },
    {
        "kind": CategoryKind.EVENT,
        "name": "Evento",
        "voice_command": "evento",
        "description": "Categoría predeterminada para eventos de calendario",
        "color": "#1E88E5",
        "icon": "calendar",
    },
    {
        "kind": CategoryKind.CAPTURE,
        "name": "Captura",
        "voice_command": "captura",
        "description": "Categoría predeterminada para capturas rápidas",
        "color": "#7CB342",
        "icon": "mic",
    },
    {
        "kind": CategoryKind.STANDARD,
        "name": "Recuerdo",
        "voice_command": "recuerdo",
        "description": "Categoría para recuerdos y momentos personales",
        "color": "#8E24AA",
        "icon": "bookmark",
    },
    {
        "kind": CategoryKind.STANDARD,
        "name": "Aprendizaje",
        "voice_command": "aprendizaje",
        "description": "Categoría para notas de estudio y aprendizajes",
        "color": "#FDD835",
        "icon": "book-open",
    },
    {
        "kind": CategoryKind.STANDARD,
        "name": "Alerta",
        "voice_command": "alerta",
        "description": "Categoría predeterminada para alertas y avisos puntuales",
        "color": "#EF4444",
        "icon": "bell",
    },
]


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

    if data.kind in (CategoryKind.EVENT, CategoryKind.CAPTURE):
        stmt_kind = select(Category).where(
            Category.user_id == user_id, Category.kind == data.kind
        )
        if db.execute(stmt_kind).scalar_one_or_none() is not None:
            raise CategoryAlreadyExistsError(
                f"A special category of kind '{data.kind.value}' already exists."
            )

    color_upper = data.color.strip().upper()
    stmt_color = select(Category).where(
        Category.user_id == user_id, Category.color == color_upper
    )
    if db.execute(stmt_color).scalar_one_or_none() is not None:
        raise CategoryAlreadyExistsError("A category with this color already exists.")

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


def seed_initial_categories(db: Session, user_id: uuid.UUID) -> list[Category]:
    """Idempotently seed standard MVP initial categories for a user."""
    created_categories: list[Category] = []
    for item in INITIAL_CATEGORIES:
        kind = item["kind"]
        name = item["name"]
        name_norm = normalize_text_key(name)

        stmt_check = select(Category).where(
            Category.user_id == user_id, Category.name_normalized == name_norm
        )

        if db.execute(stmt_check).scalar_one_or_none() is not None:
            continue

        cat_create = CategoryCreate(
            kind=kind,
            name=name,
            voice_command=item["voice_command"],
            description=item["description"],
            color=item["color"],
            icon=item["icon"],
        )
        created_categories.append(create_category(db, user_id, cat_create))

    return created_categories


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


CANONICAL_CATEGORY_ORDER: dict[str, int] = {
    "notas": 1,
    "tareas": 2,
    "eventos": 3,
    "proyectos": 4,
    "alerta": 5,
}


def list_categories(db: Session, user_id: uuid.UUID) -> list[Category]:
    """List all categories owned by a user in alphabetical order."""
    stmt = select(Category).where(Category.user_id == user_id)
    cats = list(db.execute(stmt).scalars().all())
    cats.sort(key=lambda c: unicodedata.normalize("NFKD", c.name).casefold())
    return cats


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
        color_upper = data.color.strip().upper()
        if color_upper != category.color.upper():
            stmt_color = select(Category).where(
                Category.user_id == user_id,
                Category.color == color_upper,
                Category.id != category_id,
            )
            if db.execute(stmt_color).scalar_one_or_none() is not None:
                raise CategoryAlreadyExistsError(
                    "A category with this color already exists."
                )
            category.color = color_upper
    if data.icon is not None:
        category.icon = data.icon.strip()

    category.updated_at = datetime.now(UTC)
    category.version += 1
    db.flush()
    return category


def delete_category(db: Session, user_id: uuid.UUID, category_id: uuid.UUID) -> None:
    """Delete a user's category by ID."""
    category = get_category_by_id(db, user_id, category_id)
    if (
        category.name_normalized in PROTECTED_SYSTEM_CATEGORY_NAMES
        or category.voice_command_normalized in PROTECTED_SYSTEM_CATEGORY_NAMES
    ):
        raise ProtectedCategoryError(
            "Las categorías del sistema (Tarea, Alerta, Evento, Nota) no se pueden eliminar."
        )
    db.delete(category)
    db.flush()
