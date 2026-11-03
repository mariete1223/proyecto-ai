from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.models.domain import (
    CaptureCorrection,
    Category,
    DeletionTombstone,
    Entry,
    EntryTag,
    SavePreference,
    Tag,
)
from app.models.enums import (
    CategoryKind,
    CorrectionField,
    SaveMode,
    TaskPriority,
    TaskRecurrence,
    TaskStatus,
    TombstoneEntity,
)
from app.schemas.sync import (
    PushResultStatus,
    SyncAction,
    SyncClientChange,
    SyncPullChange,
    SyncPushChangeResult,
    SyncTombstone,
)
from app.services.category_service import (
    CANONICAL_CATEGORY_IDS,
    PROTECTED_SYSTEM_CATEGORY_NAMES,
    normalize_text_key,
    seed_initial_categories,
)
from app.services.tag_service import normalize_tag_name

EVENT_CATEGORY_ALIASES: set[str] = {"evento", "eventos", "event", "events"}
TASK_CATEGORY_ALIASES: set[str] = {"tarea", "tareas", "task", "tasks"}
ALERT_CATEGORY_ALIASES: set[str] = {"alerta", "alertas", "alert", "alerts"}
NEUTRAL_CATEGORY_ALIASES: set[str] = {"nota", "notas", "note", "notes", "general"}
PROJECT_CATEGORY_ALIASES: set[str] = {"proyecto", "proyectos", "project", "projects"}
HEALTH_CATEGORY_ALIASES: set[str] = {"salud", "health"}

SHORTHAND_CATEGORY_ALIASES: dict[str, str] = {
    "cat-events": "eventos",
    "cat-event": "eventos",
    "evento": "eventos",
    "eventos": "eventos",
    "cat-tasks": "tareas",
    "cat-task": "tareas",
    "tarea": "tareas",
    "tareas": "tareas",
    "cat-alerts": "alerta",
    "cat-alert": "alerta",
    "alerta": "alerta",
    "alertas": "alerta",
    "cat-notes": "notas",
    "cat-note": "notas",
    "nota": "notas",
    "notas": "notas",
    "cat-projects": "proyectos",
    "cat-project": "proyectos",
    "proyecto": "proyectos",
    "proyectos": "proyectos",
}


def _model_to_dict(model: Any) -> dict[str, Any]:
    """Convert domain model instance to dictionary for sync payload serialization."""
    d: dict[str, Any] = {}
    for col in model.__table__.columns:
        val = getattr(model, col.name)
        if isinstance(val, uuid.UUID):
            d[col.name] = str(val)
        elif isinstance(val, datetime):
            if val.tzinfo is None:
                val = val.replace(tzinfo=UTC)
            else:
                val = val.astimezone(UTC)
            d[col.name] = val.isoformat().replace("+00:00", "Z")
        elif hasattr(val, "value"):  # Enum
            d[col.name] = val.value
        else:
            d[col.name] = val
    return d


def _to_comparable_dt(val: Any) -> datetime:
    if isinstance(val, str):
        val_str = val.strip()
        if " " in val_str and "T" not in val_str:
            val_str = val_str.replace(" ", "T")
        if (
            "T" in val_str
            and not val_str.endswith("Z")
            and not ("+" in val_str[10:] or "-" in val_str[10:])
        ):
            val_str = val_str + "Z"
        val = datetime.fromisoformat(val_str.replace("Z", "+00:00"))
    if isinstance(val, datetime):
        if val.tzinfo is not None:
            return val.astimezone(UTC).replace(tzinfo=None)
        return val
    return datetime.min


def _parse_dt(val: Any) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=UTC)
        return val.astimezone(UTC)
    if isinstance(val, str):
        val_str = val.strip()
        if not val_str:
            return None
        if " " in val_str and "T" not in val_str:
            val_str = val_str.replace(" ", "T")
        if (
            "T" in val_str
            and not val_str.endswith("Z")
            and not ("+" in val_str[10:] or "-" in val_str[10:])
        ):
            val_str = val_str + "Z"
        dt = datetime.fromisoformat(val_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    return None


def process_sync_push(
    db: Session, user_id: uuid.UUID, client_changes: list[SyncClientChange]
) -> list[SyncPushChangeResult]:
    """Process a batch of client push changes idempotently."""
    seed_initial_categories(db, user_id)
    results: list[SyncPushChangeResult] = []

    for change in client_changes:
        savepoint = db.begin_nested()
        try:
            res = _process_single_change(db, user_id, change)
            savepoint.commit()
            results.append(res)
        except Exception as exc:
            savepoint.rollback()
            results.append(
                SyncPushChangeResult(
                    change_id=change.change_id,
                    entity_type=change.entity_type,
                    entity_id=change.entity_id,
                    status=PushResultStatus.REJECTED,
                    error_message=str(exc),
                )
            )

    return results


def _process_single_change(
    db: Session, user_id: uuid.UUID, change: SyncClientChange
) -> SyncPushChangeResult:
    now = datetime.now(UTC)

    # Check tombstone first
    stmt_tb = select(DeletionTombstone).where(
        DeletionTombstone.user_id == user_id,
        DeletionTombstone.entity_type == change.entity_type,
        DeletionTombstone.entity_id == change.entity_id,
    )
    tombstone = db.execute(stmt_tb).scalar_one_or_none()
    if tombstone is not None:
        if change.action == SyncAction.DELETE:
            return SyncPushChangeResult(
                change_id=change.change_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                status=PushResultStatus.ALREADY_APPLIED,
                applied_version=tombstone.deleted_version,
            )
        if change.action == SyncAction.CREATE and change.entity_type in (
            TombstoneEntity.CATEGORY,
            TombstoneEntity.TAG,
        ):
            db.delete(tombstone)
            db.flush()
        else:
            return SyncPushChangeResult(
                change_id=change.change_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                status=PushResultStatus.CONFLICT,
                error_message="Entity was deleted on server.",
            )

    # Map model class
    model_cls_map: dict[TombstoneEntity, Any] = {
        TombstoneEntity.CATEGORY: Category,
        TombstoneEntity.TAG: Tag,
        TombstoneEntity.ENTRY: Entry,
        TombstoneEntity.ENTRY_TAG: EntryTag,
        TombstoneEntity.SAVE_PREFERENCE: SavePreference,
        TombstoneEntity.CAPTURE_CORRECTION: CaptureCorrection,
    }
    model_cls: Any = model_cls_map.get(change.entity_type)
    if model_cls is None:
        return SyncPushChangeResult(
            change_id=change.change_id,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            status=PushResultStatus.REJECTED,
            error_message=f"Unsupported entity type: {change.entity_type}",
        )

    stmt_existing = select(model_cls).where(
        model_cls.id == change.entity_id, model_cls.user_id == user_id
    )
    existing_item: Any = db.execute(stmt_existing).scalar_one_or_none()

    if change.entity_type == TombstoneEntity.CATEGORY and existing_item is None:
        canonical_lookup: dict[uuid.UUID, list[Any]] = {
            CANONICAL_CATEGORY_IDS["eventos"]: [
                Category.kind == CategoryKind.EVENT,
                Category.name_normalized.in_(EVENT_CATEGORY_ALIASES),
                Category.voice_command_normalized.in_(EVENT_CATEGORY_ALIASES),
            ],
            CANONICAL_CATEGORY_IDS["tareas"]: [
                Category.kind == CategoryKind.TASK,
                Category.name_normalized.in_(TASK_CATEGORY_ALIASES),
                Category.voice_command_normalized.in_(TASK_CATEGORY_ALIASES),
            ],
            CANONICAL_CATEGORY_IDS["alerta"]: [
                Category.name_normalized.in_(ALERT_CATEGORY_ALIASES),
                Category.voice_command_normalized.in_(ALERT_CATEGORY_ALIASES),
            ],
            CANONICAL_CATEGORY_IDS["notas"]: [
                Category.name_normalized.in_(NEUTRAL_CATEGORY_ALIASES),
                Category.voice_command_normalized.in_(NEUTRAL_CATEGORY_ALIASES),
            ],
            CANONICAL_CATEGORY_IDS["proyectos"]: [
                Category.name_normalized.in_(PROJECT_CATEGORY_ALIASES),
                Category.voice_command_normalized.in_(PROJECT_CATEGORY_ALIASES),
            ],
        }
        if "salud" in CANONICAL_CATEGORY_IDS:
            canonical_lookup[CANONICAL_CATEGORY_IDS["salud"]] = [
                Category.name_normalized.in_(HEALTH_CATEGORY_ALIASES),
                Category.voice_command_normalized.in_(HEALTH_CATEGORY_ALIASES),
            ]
        if change.entity_id in canonical_lookup:
            existing_item = (
                db.execute(
                    select(Category).where(
                        Category.user_id == user_id,
                        or_(*canonical_lookup[change.entity_id]),
                    )
                )
                .scalars()
                .first()
            )
        if existing_item is None:
            name_val = str(change.payload.get("name", "")).strip()
            name_norm = normalize_text_key(name_val) if name_val else ""
            if name_norm:
                same_name_cat = (
                    db.execute(
                        select(Category).where(
                            Category.user_id == user_id,
                            Category.name_normalized.in_([name_norm, name_norm + "s"]),
                        )
                    )
                    .scalars()
                    .first()
                )
                if same_name_cat is not None:
                    existing_item = same_name_cat

    if (
        change.entity_type == TombstoneEntity.TAG
        and existing_item is None
        and change.action == SyncAction.CREATE
    ):
        name_val = str(change.payload.get("name", "")).strip()
        if name_val:
            name_norm = normalize_tag_name(name_val)
            if name_norm:
                existing_tag_by_name = db.execute(
                    select(Tag).where(
                        Tag.user_id == user_id,
                        Tag.name_normalized == name_norm,
                    )
                ).scalar_one_or_none()
                if existing_tag_by_name is not None:
                    existing_item = existing_tag_by_name

    if change.action == SyncAction.CREATE:
        if existing_item is not None:
            if existing_item.version == 1 or existing_item.id != change.entity_id:
                return SyncPushChangeResult(
                    change_id=change.change_id,
                    entity_type=change.entity_type,
                    entity_id=change.entity_id,
                    status=PushResultStatus.ALREADY_APPLIED,
                    applied_version=existing_item.version,
                    server_entity=_model_to_dict(existing_item),
                )
            return SyncPushChangeResult(
                change_id=change.change_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                status=PushResultStatus.CONFLICT,
                server_entity=_model_to_dict(existing_item),
            )

        new_item = _create_domain_model(
            db, change.entity_type, user_id, change.entity_id, change.payload, now
        )
        db.add(new_item)
        db.flush()
        return SyncPushChangeResult(
            change_id=change.change_id,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            status=PushResultStatus.APPLIED,
            applied_version=1,
        )

    elif change.action == SyncAction.UPDATE:
        if existing_item is None:
            return SyncPushChangeResult(
                change_id=change.change_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                status=PushResultStatus.REJECTED,
                error_message="Entity to update not found on server.",
            )

        has_title_enrichment = (
            change.entity_type == TombstoneEntity.ENTRY
            and getattr(existing_item, "title", None) is None
            and bool(change.payload.get("title"))
        )

        if existing_item.version == change.base_version or has_title_enrichment:
            new_version = max(existing_item.version, change.base_version) + 1
            _update_domain_model(
                db, existing_item, change.entity_type, change.payload, now, new_version
            )
            db.flush()
            return SyncPushChangeResult(
                change_id=change.change_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                status=PushResultStatus.APPLIED,
                applied_version=new_version,
            )
        else:
            return SyncPushChangeResult(
                change_id=change.change_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                status=PushResultStatus.CONFLICT,
                server_entity=_model_to_dict(existing_item),
            )

    elif change.action == SyncAction.DELETE:
        if existing_item is None:
            return SyncPushChangeResult(
                change_id=change.change_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                status=PushResultStatus.ALREADY_APPLIED,
            )

        if change.entity_type == TombstoneEntity.CATEGORY:
            name_norm = getattr(existing_item, "name_normalized", "")
            vc_norm = getattr(existing_item, "voice_command_normalized", "")
            protected_ids = {
                CANONICAL_CATEGORY_IDS["tareas"],
                CANONICAL_CATEGORY_IDS["alerta"],
            }
            if (
                name_norm in PROTECTED_SYSTEM_CATEGORY_NAMES
                or vc_norm in PROTECTED_SYSTEM_CATEGORY_NAMES
                or existing_item.id in protected_ids
                or change.entity_id in protected_ids
            ):
                return SyncPushChangeResult(
                    change_id=change.change_id,
                    entity_type=change.entity_type,
                    entity_id=change.entity_id,
                    status=PushResultStatus.REJECTED,
                    error_message="System category cannot be deleted.",
                )

        if (
            existing_item.version > change.base_version
            and existing_item.version != change.base_version + 1
        ):
            return SyncPushChangeResult(
                change_id=change.change_id,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                status=PushResultStatus.CONFLICT,
                server_entity=_model_to_dict(existing_item),
            )

        deleted_version = existing_item.version + 1
        if deleted_version < 2:
            deleted_version = 2

        # Cascading / Reassignment cleanup to avoid foreign key errors
        if change.entity_type == TombstoneEntity.CATEGORY:
            target_cat_ids = [change.entity_id, existing_item.id]
            other_cat = (
                db.execute(
                    select(Category)
                    .where(
                        Category.user_id == user_id,
                        Category.id.notin_(target_cat_ids),
                    )
                    .order_by(Category.created_at.asc())
                )
                .scalars()
                .first()
            )
            if other_cat is not None:
                db.execute(
                    update(Entry)
                    .where(
                        Entry.user_id == user_id,
                        Entry.category_id.in_(target_cat_ids),
                    )
                    .values(
                        category_id=other_cat.id,
                        updated_at=now,
                        version=Entry.version + 1,
                    )
                )
                db.flush()
        elif change.entity_type == TombstoneEntity.TAG:
            db.execute(
                delete(EntryTag).where(
                    EntryTag.user_id == user_id,
                    EntryTag.tag_id.in_([change.entity_id, existing_item.id]),
                )
            )
            db.flush()
        elif change.entity_type == TombstoneEntity.ENTRY:
            db.execute(
                delete(EntryTag).where(
                    EntryTag.user_id == user_id,
                    EntryTag.entry_id == change.entity_id,
                )
            )
            db.flush()

        db.delete(existing_item)
        db.flush()

        tb = DeletionTombstone(
            id=uuid.uuid4(),
            user_id=user_id,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            deleted_at=now,
            deleted_version=deleted_version,
        )
        db.add(tb)
        db.flush()

        return SyncPushChangeResult(
            change_id=change.change_id,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            status=PushResultStatus.APPLIED,
            applied_version=deleted_version,
        )

    return SyncPushChangeResult(
        change_id=change.change_id,
        entity_type=change.entity_type,
        entity_id=change.entity_id,
        status=PushResultStatus.REJECTED,
        error_message=f"Unsupported action: {change.action}",
    )


def _resolve_category_id_for_user(
    db: Session,
    user_id: uuid.UUID,
    raw_cat_id: Any,
    default_entity_id: uuid.UUID,
    is_task: bool = False,
    has_occurred_at: bool = False,
) -> uuid.UUID:
    """Resolve category ID for a user, handling exact matches, aliases, and fallbacks."""
    cat_id = default_entity_id
    if raw_cat_id:
        raw_str = str(raw_cat_id).strip().lower()
        canon_key = SHORTHAND_CATEGORY_ALIASES.get(raw_str)
        if canon_key and canon_key in CANONICAL_CATEGORY_IDS:
            cat_id = CANONICAL_CATEGORY_IDS[canon_key]
        else:
            try:
                cat_id = uuid.UUID(str(raw_cat_id).strip())
            except (ValueError, TypeError):
                cat_id = default_entity_id

    # 1. Exact match on user's category
    stmt_cat = select(Category).where(
        Category.id == cat_id, Category.user_id == user_id
    )
    if db.execute(stmt_cat).scalar_one_or_none() is not None:
        return cat_id

    # 2. Canonical category alias rules (legacy UUID mapping)
    canonical_alias_rules: dict[uuid.UUID, list[Any]] = {
        CANONICAL_CATEGORY_IDS.get(
            "eventos", uuid.UUID("45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd")
        ): [
            Category.kind == CategoryKind.EVENT,
            Category.name_normalized.in_(EVENT_CATEGORY_ALIASES),
            Category.voice_command_normalized.in_(EVENT_CATEGORY_ALIASES),
        ],
        CANONICAL_CATEGORY_IDS.get(
            "notas", uuid.UUID("740d7f77-ae95-4898-a80b-4a31bc58061b")
        ): [
            Category.name_normalized.in_(NEUTRAL_CATEGORY_ALIASES),
            Category.voice_command_normalized.in_(NEUTRAL_CATEGORY_ALIASES),
        ],
        CANONICAL_CATEGORY_IDS.get(
            "tareas", uuid.UUID("20e8f404-c429-43e8-8cf8-af9d51416d58")
        ): [
            Category.kind == CategoryKind.TASK,
            Category.name_normalized.in_(TASK_CATEGORY_ALIASES),
            Category.voice_command_normalized.in_(TASK_CATEGORY_ALIASES),
        ],
        CANONICAL_CATEGORY_IDS.get(
            "proyectos", uuid.UUID("994777f6-09d3-4ef9-876a-3b29d09d5fa4")
        ): [
            Category.name_normalized.in_(PROJECT_CATEGORY_ALIASES),
            Category.voice_command_normalized.in_(PROJECT_CATEGORY_ALIASES),
        ],
        CANONICAL_CATEGORY_IDS.get(
            "alerta", uuid.UUID("c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9")
        ): [
            Category.name_normalized.in_(ALERT_CATEGORY_ALIASES),
            Category.voice_command_normalized.in_(ALERT_CATEGORY_ALIASES),
        ],
    }

    if cat_id in canonical_alias_rules:
        filters = canonical_alias_rules[cat_id]
        alias_cat = (
            db.execute(
                select(Category).where(
                    Category.user_id == user_id,
                    or_(*filters),
                )
            )
            .scalars()
            .first()
        )
        if alias_cat is not None:
            return alias_cat.id

    # 3. If payload indicates task, look for task category
    if is_task:
        task_cat = (
            db.execute(
                select(Category).where(
                    Category.user_id == user_id,
                    or_(
                        Category.id == CANONICAL_CATEGORY_IDS.get("tareas"),
                        Category.kind == CategoryKind.TASK,
                        Category.name_normalized.in_(TASK_CATEGORY_ALIASES),
                    ),
                )
            )
            .scalars()
            .first()
        )
        if task_cat is not None:
            return task_cat.id

    # 3b. If payload indicates event (has date/time and not a task), look for event category
    if has_occurred_at and not is_task:
        event_cat = (
            db.execute(
                select(Category).where(
                    Category.user_id == user_id,
                    or_(
                        Category.id == CANONICAL_CATEGORY_IDS.get("eventos"),
                        Category.kind == CategoryKind.EVENT,
                        Category.name_normalized.in_(EVENT_CATEGORY_ALIASES),
                    ),
                )
            )
            .scalars()
            .first()
        )
        if event_cat is not None:
            return event_cat.id

    # 4. Neutral fallbacks (never blindly fall back to Alerta)
    neutral_cat = (
        db.execute(
            select(Category).where(
                Category.user_id == user_id,
                Category.name_normalized.in_(NEUTRAL_CATEGORY_ALIASES),
            )
        )
        .scalars()
        .first()
    )
    if neutral_cat is not None:
        return neutral_cat.id

    neutral_cat = (
        db.execute(
            select(Category).where(
                Category.user_id == user_id,
                Category.name_normalized.in_(EVENT_CATEGORY_ALIASES),
            )
        )
        .scalars()
        .first()
    )
    if neutral_cat is not None:
        return neutral_cat.id

    neutral_cat = (
        db.execute(
            select(Category).where(
                Category.user_id == user_id,
                Category.kind != CategoryKind.TASK,
                ~Category.name_normalized.in_(ALERT_CATEGORY_ALIASES),
            )
        )
        .scalars()
        .first()
    )
    if neutral_cat is not None:
        return neutral_cat.id

    # 5. Last resort fallback
    last_resort = (
        db.execute(
            select(Category)
            .where(Category.user_id == user_id)
            .order_by(Category.created_at.asc())
        )
        .scalars()
        .first()
    )
    if last_resort is not None:
        return last_resort.id

    return cat_id


def _create_domain_model(
    db: Session,
    entity_type: TombstoneEntity,
    user_id: uuid.UUID,
    entity_id: uuid.UUID,
    payload: dict[str, Any],
    now: datetime,
) -> Any:
    if entity_type == TombstoneEntity.CATEGORY:
        name = str(payload.get("name", "")).strip()
        voice_command = str(payload.get("voice_command", "")).strip() or name
        kind_str = payload.get("kind", "STANDARD")
        color = str(payload.get("color") or "#38BDF8").strip()
        if not (len(color) == 7 and color.startswith("#")):
            color = "#38BDF8"
        description = str(payload.get("description") or "Category description").strip()
        if not description:
            description = "Category description"
        actual_id = entity_id
        if (
            db.execute(
                select(Category.id).where(Category.id == actual_id)
            ).scalar_one_or_none()
            is not None
        ):
            actual_id = uuid.uuid4()
        return Category(
            id=actual_id,
            user_id=user_id,
            kind=CategoryKind(kind_str),
            name=name,
            name_normalized=normalize_text_key(name),
            voice_command=voice_command,
            voice_command_normalized=normalize_text_key(voice_command),
            description=description,
            color=color.upper(),
            icon=str(payload.get("icon", "folder")),
            created_at=now,
            updated_at=now,
            version=1,
        )
    elif entity_type == TombstoneEntity.TAG:
        name = str(payload.get("name", "")).strip()
        color = str(payload.get("color") or "#64748B").strip().upper()
        if not (len(color) == 7 and color.startswith("#")):
            color = "#64748B"
        return Tag(
            id=entity_id,
            user_id=user_id,
            name=name,
            name_normalized=normalize_tag_name(name),
            color=color,
            created_at=now,
            updated_at=now,
            version=1,
        )
    elif entity_type == TombstoneEntity.ENTRY:
        status_str = payload.get("task_status")
        rec_str = payload.get("task_recurrence")
        if status_str and not rec_str:
            rec_str = "ONCE"
        elif rec_str and not status_str:
            status_str = "PENDING"
        cat_id_raw = payload.get("category_id")
        occ_at = _parse_dt(payload.get("occurred_at"))
        cat_id = _resolve_category_id_for_user(
            db,
            user_id,
            cat_id_raw,
            entity_id,
            is_task=bool(status_str),
            has_occurred_at=bool(occ_at),
        )

        session_id_raw = payload.get("capture_session_id")
        session_id = uuid.UUID(session_id_raw) if session_id_raw else None
        title_val = payload.get("title")
        title = str(title_val).strip() if title_val else None
        prio_str = payload.get("task_priority")
        if status_str and not prio_str:
            prio_str = "MEDIUM"
        elif not status_str:
            prio_str = None
        rem_enabled = bool(payload.get("reminder_enabled"))
        rem_time = _parse_dt(payload.get("reminder_time"))
        rem_offset = int(payload.get("reminder_offset_minutes") or 0)
        if rem_enabled and occ_at and not rem_time:
            rem_time = occ_at - timedelta(minutes=rem_offset)
        return Entry(
            id=entity_id,
            user_id=user_id,
            category_id=cat_id,
            title=title,
            occurred_at=occ_at,
            content=str(payload.get("content", "")).strip(),
            task_status=TaskStatus(status_str) if status_str else None,
            task_priority=TaskPriority(prio_str) if prio_str else None,
            task_recurrence=TaskRecurrence(rec_str) if rec_str else None,
            capture_session_id=session_id,
            reminder_enabled=rem_enabled,
            reminder_time=rem_time,
            reminder_end_time=_parse_dt(payload.get("reminder_end_time")),
            reminder_recurrence=str(payload.get("reminder_recurrence") or "NONE"),
            reminder_offset_minutes=rem_offset,
            created_at=now,
            updated_at=now,
            version=1,
        )
    elif entity_type == TombstoneEntity.ENTRY_TAG:
        e_id = uuid.UUID(str(payload.get("entry_id")))
        t_id = uuid.UUID(str(payload.get("tag_id")))
        return EntryTag(
            id=entity_id,
            user_id=user_id,
            entry_id=e_id,
            tag_id=t_id,
            created_at=now,
            updated_at=now,
            version=1,
        )
    elif entity_type == TombstoneEntity.SAVE_PREFERENCE:
        mode_str = payload.get("mode", "FAST_FORWARD")
        return SavePreference(
            id=entity_id,
            user_id=user_id,
            mode=SaveMode(mode_str),
            created_at=now,
            updated_at=now,
            version=1,
        )
    elif entity_type == TombstoneEntity.CAPTURE_CORRECTION:
        e_id = uuid.UUID(str(payload.get("entry_id")))
        cs_id = uuid.UUID(str(payload.get("capture_session_id")))
        field_str = str(payload.get("field"))
        return CaptureCorrection(
            id=entity_id,
            user_id=user_id,
            entry_id=e_id,
            capture_session_id=cs_id,
            field=CorrectionField(field_str),
            interpreted_value=payload.get("interpreted_value"),
            accepted_value=payload.get("accepted_value"),
            created_at=now,
            updated_at=now,
            version=1,
        )
    raise ValueError(f"Unknown entity type: {entity_type}")


def _update_domain_model(
    db: Session,
    item: Any,
    entity_type: TombstoneEntity,
    payload: dict[str, Any],
    now: datetime,
    new_version: int,
) -> None:
    if entity_type == TombstoneEntity.CATEGORY:
        if "name" in payload:
            name = str(payload["name"]).strip()
            item.name = name
            item.name_normalized = normalize_text_key(name)
        if "voice_command" in payload:
            vc = str(payload["voice_command"]).strip()
            item.voice_command = vc
            item.voice_command_normalized = normalize_text_key(vc)
        if "description" in payload:
            item.description = str(payload["description"])
        if "color" in payload:
            item.color = str(payload["color"])
        if "icon" in payload:
            item.icon = str(payload["icon"])
    elif entity_type == TombstoneEntity.TAG:
        if "name" in payload:
            name = str(payload["name"]).strip()
            item.name = name
            item.name_normalized = normalize_tag_name(name)
        if "color" in payload:
            color = str(payload["color"]).strip().upper()
            if len(color) == 7 and color.startswith("#"):
                item.color = color
    elif entity_type == TombstoneEntity.ENTRY:
        if "title" in payload:
            t_val = payload.get("title")
            item.title = str(t_val).strip() if t_val else None
        if "content" in payload:
            item.content = str(payload["content"]).strip()
        if "category_id" in payload:
            is_task_entry = bool(item.task_status or payload.get("task_status"))
            has_occ_at = bool(item.occurred_at or payload.get("occurred_at"))
            item.category_id = _resolve_category_id_for_user(
                db,
                item.user_id,
                payload["category_id"],
                item.category_id,
                is_task=is_task_entry,
                has_occurred_at=has_occ_at,
            )
        if "occurred_at" in payload:
            item.occurred_at = _parse_dt(payload["occurred_at"])
        if "task_status" in payload:
            status_val = payload["task_status"]
            item.task_status = TaskStatus(status_val) if status_val else None
        if "task_recurrence" in payload:
            rec_val = payload["task_recurrence"]
            item.task_recurrence = TaskRecurrence(rec_val) if rec_val else None
        if "task_priority" in payload:
            prio_val = payload["task_priority"]
            item.task_priority = TaskPriority(prio_val) if prio_val else None
        if item.task_status and not item.task_recurrence:
            item.task_recurrence = TaskRecurrence.ONCE
        elif item.task_recurrence and not item.task_status:
            item.task_status = TaskStatus.PENDING
        if not item.task_status:
            item.task_priority = None
        elif item.task_status and not item.task_priority:
            item.task_priority = TaskPriority.MEDIUM
        if "reminder_enabled" in payload:
            item.reminder_enabled = bool(payload["reminder_enabled"])
        if "reminder_time" in payload:
            item.reminder_time = _parse_dt(payload["reminder_time"])
        if "reminder_end_time" in payload:
            item.reminder_end_time = _parse_dt(payload["reminder_end_time"])
        if "reminder_recurrence" in payload:
            item.reminder_recurrence = str(payload["reminder_recurrence"] or "NONE")
        if "reminder_offset_minutes" in payload:
            item.reminder_offset_minutes = int(payload["reminder_offset_minutes"] or 0)
        if item.reminder_enabled and item.occurred_at and not item.reminder_time:
            item.reminder_time = item.occurred_at - timedelta(
                minutes=item.reminder_offset_minutes or 0
            )
    elif entity_type == TombstoneEntity.SAVE_PREFERENCE:
        if "mode" in payload:
            item.mode = SaveMode(payload["mode"])

    item.updated_at = now
    item.version = new_version


def process_sync_pull(
    db: Session,
    user_id: uuid.UUID,
    cursor_str: str | None = None,
    limit: int = 50,
) -> tuple[list[SyncPullChange], list[SyncTombstone], str | None, bool]:
    """Pull incremental changes and tombstones for a user after cursor."""
    if limit < 1 or limit > 100:
        raise ValueError("Limit must be between 1 and 100.")

    seed_initial_categories(db, user_id)

    cursor_dt = _parse_dt(cursor_str) if cursor_str else None

    events: list[tuple[datetime, bool, Any, TombstoneEntity]] = []

    models: list[tuple[TombstoneEntity, Any]] = [
        (TombstoneEntity.CATEGORY, Category),
        (TombstoneEntity.TAG, Tag),
        (TombstoneEntity.ENTRY, Entry),
        (TombstoneEntity.ENTRY_TAG, EntryTag),
        (TombstoneEntity.SAVE_PREFERENCE, SavePreference),
        (TombstoneEntity.CAPTURE_CORRECTION, CaptureCorrection),
    ]

    active_ids_by_type: dict[TombstoneEntity, set[uuid.UUID]] = {}
    for entity_type, model_cls in models:
        all_user_ids: set[uuid.UUID] = set(
            db.execute(select(model_cls.id).where(model_cls.user_id == user_id))
            .scalars()
            .all()
        )
        active_ids_by_type[entity_type] = all_user_ids
        stmt = select(model_cls).where(model_cls.user_id == user_id)
        if cursor_dt is not None:
            stmt = stmt.where(model_cls.updated_at > cursor_dt)
        items: list[Any] = list(db.execute(stmt).scalars().all())
        for item in items:
            events.append((item.updated_at, False, item, entity_type))

    stmt_tb = select(DeletionTombstone).where(DeletionTombstone.user_id == user_id)
    if cursor_dt is not None:
        stmt_tb = stmt_tb.where(DeletionTombstone.deleted_at > cursor_dt)
    tbs = db.execute(stmt_tb).scalars().all()
    for tb in tbs:
        if tb.entity_id in active_ids_by_type.get(tb.entity_type, set()):
            continue
        events.append((tb.deleted_at, True, tb, tb.entity_type))

    events.sort(key=lambda x: (_to_comparable_dt(x[0]), str(getattr(x[2], "id", ""))))

    has_more = len(events) > limit
    page_events = events[:limit]

    user_cats = list(
        db.execute(select(Category).where(Category.user_id == user_id)).scalars().all()
    )
    user_cat_to_canonical: dict[uuid.UUID, uuid.UUID] = {}
    for c in user_cats:
        name_norm = c.name_normalized or normalize_text_key(c.name)
        if c.kind == CategoryKind.EVENT or name_norm in ("evento", "eventos"):
            user_cat_to_canonical[c.id] = CANONICAL_CATEGORY_IDS.get(
                "eventos", uuid.UUID("45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd")
            )
        elif c.kind == CategoryKind.TASK or name_norm in ("tarea", "tareas"):
            user_cat_to_canonical[c.id] = CANONICAL_CATEGORY_IDS.get(
                "tareas", uuid.UUID("20e8f404-c429-43e8-8cf8-af9d51416d58")
            )
        elif name_norm in ("nota", "notas"):
            user_cat_to_canonical[c.id] = CANONICAL_CATEGORY_IDS.get(
                "notas", uuid.UUID("740d7f77-ae95-4898-a80b-4a31bc58061b")
            )
        elif name_norm in ("alerta", "alertas"):
            user_cat_to_canonical[c.id] = CANONICAL_CATEGORY_IDS.get(
                "alerta", uuid.UUID("c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9")
            )
        elif name_norm in ("proyecto", "proyectos"):
            user_cat_to_canonical[c.id] = CANONICAL_CATEGORY_IDS.get(
                "proyectos", uuid.UUID("994777f6-09d3-4ef9-876a-3b29d09d5fa4")
            )

    changes: list[SyncPullChange] = []
    tombstones: list[SyncTombstone] = []
    next_cursor: str | None = None

    for evt_time, is_tb, obj, ent_type in page_events:
        next_cursor = evt_time.isoformat()
        if is_tb:
            tb_entity_id = obj.entity_id
            if (
                ent_type == TombstoneEntity.CATEGORY
                and obj.entity_id in user_cat_to_canonical
            ):
                tb_entity_id = user_cat_to_canonical[obj.entity_id]
            tombstones.append(
                SyncTombstone(
                    entity_type=ent_type,
                    entity_id=tb_entity_id,
                    deleted_at=obj.deleted_at.isoformat(),
                    deleted_version=obj.deleted_version,
                )
            )
        else:
            action = SyncAction.CREATE if obj.version == 1 else SyncAction.UPDATE
            payload = _model_to_dict(obj)
            change_entity_id = obj.id
            if ent_type == TombstoneEntity.ENTRY:
                raw_cat_id = obj.category_id
                if raw_cat_id in user_cat_to_canonical:
                    payload["category_id"] = str(user_cat_to_canonical[raw_cat_id])
            elif ent_type == TombstoneEntity.CATEGORY:
                if obj.id in user_cat_to_canonical:
                    canon_id = user_cat_to_canonical[obj.id]
                    payload["id"] = str(canon_id)
                    change_entity_id = canon_id
            changes.append(
                SyncPullChange(
                    entity_type=ent_type,
                    entity_id=change_entity_id,
                    action=action,
                    payload=payload,
                )
            )

    return changes, tombstones, next_cursor, has_more
