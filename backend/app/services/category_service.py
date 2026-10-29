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


CANONICAL_CATEGORY_IDS: dict[str, uuid.UUID] = {
    "notas": uuid.UUID("740d7f77-ae95-4898-a80b-4a31bc58061b"),
    "tareas": uuid.UUID("20e8f404-c429-43e8-8cf8-af9d51416d58"),
    "eventos": uuid.UUID("45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd"),
    "proyectos": uuid.UUID("994777f6-09d3-4ef9-876a-3b29d09d5fa4"),
    "alerta": uuid.UUID("c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9"),
}

INITIAL_CATEGORIES: list[dict[str, Any]] = [
    {
        "id": CANONICAL_CATEGORY_IDS["tareas"],
        "kind": CategoryKind.TASK,
        "name": "Tarea",
        "voice_command": "tarea",
        "description": "Categoría predeterminada para tareas y cosas pendientes",
        "color": "#E53935",
        "icon": "check-square",
    },
    {
        "id": CANONICAL_CATEGORY_IDS["eventos"],
        "kind": CategoryKind.EVENT,
        "name": "Evento",
        "voice_command": "evento",
        "description": "Categoría predeterminada para eventos de calendario",
        "color": "#1E88E5",
        "icon": "calendar",
    },
    {
        "id": uuid.UUID("7cb34200-c429-43e8-8cf8-af9d51416d58"),
        "kind": CategoryKind.CAPTURE,
        "name": "Captura",
        "voice_command": "captura",
        "description": "Categoría predeterminada para capturas rápidas",
        "color": "#7CB342",
        "icon": "mic",
    },
    {
        "id": uuid.UUID("8e24aa00-c429-43e8-8cf8-af9d51416d58"),
        "kind": CategoryKind.STANDARD,
        "name": "Recuerdo",
        "voice_command": "recuerdo",
        "description": "Categoría para recuerdos y momentos personales",
        "color": "#8E24AA",
        "icon": "bookmark",
    },
    {
        "id": uuid.UUID("fdd83500-c429-43e8-8cf8-af9d51416d58"),
        "kind": CategoryKind.STANDARD,
        "name": "Aprendizaje",
        "voice_command": "aprendizaje",
        "description": "Categoría para notas de estudio y aprendizajes",
        "color": "#FDD835",
        "icon": "book-open",
    },
    {
        "id": CANONICAL_CATEGORY_IDS["alerta"],
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


def create_category(
    db: Session,
    user_id: uuid.UUID,
    data: CategoryCreate,
    category_id: uuid.UUID | None = None,
) -> Category:
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

    category_uuid = category_id
    if category_uuid is not None:
        stmt_id = select(Category).where(Category.id == category_uuid)
        if db.execute(stmt_id).scalar_one_or_none() is not None:
            category_uuid = uuid.uuid4()
    else:
        category_uuid = uuid.uuid4()

    now = datetime.now(UTC)
    category = Category(
        id=category_uuid,
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
        item_id: uuid.UUID = item["id"]
        name_norm = normalize_text_key(name)

        # Check by name_normalized or id or plural equivalent ("tarea"/"tareas", "evento"/"eventos")
        plural_norm = name_norm + "s"
        stmt_check = select(Category).where(
            Category.user_id == user_id,
            (Category.name_normalized.in_([name_norm, plural_norm]))
            | (Category.id == item_id),
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
        created_categories.append(
            create_category(db, user_id, cat_create, category_id=item_id)
        )

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
