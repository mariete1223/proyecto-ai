from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select, update
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
from app.services.category_service import seed_initial_categories
from app.services.category_service import normalize_text_key
from app.services.tag_service import normalize_tag_name


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

    if change.action == SyncAction.CREATE:
        if existing_item is not None:
            if existing_item.version == 1:
                return SyncPushChangeResult(
                    change_id=change.change_id,
                    entity_type=change.entity_type,
                    entity_id=change.entity_id,
                    status=PushResultStatus.ALREADY_APPLIED,
                    applied_version=1,
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
            # Reassign any entries referencing this category to another remaining category
            other_cat = (
                db.execute(
                    select(Category)
                    .where(
                        Category.user_id == user_id,
                        Category.id != change.entity_id,
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
                        Entry.category_id == change.entity_id,
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
                    EntryTag.tag_id == change.entity_id,
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
        return Category(
            id=entity_id,
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
        cat_id = uuid.UUID(cat_id_raw) if cat_id_raw else entity_id

        # Comprobar que la categoría exista para evitar IntegrityError / Foreign Key failure
        stmt_cat = select(Category).where(
            Category.id == cat_id, Category.user_id == user_id
        )
        if db.execute(stmt_cat).scalar_one_or_none() is None:
            fallback_cat = (
                db.execute(
                    select(Category)
                    .where(Category.user_id == user_id)
                    .order_by(Category.created_at.asc())
                )
                .scalars()
                .first()
            )
            if fallback_cat is not None:
                cat_id = fallback_cat.id

        session_id_raw = payload.get("capture_session_id")
        session_id = uuid.UUID(session_id_raw) if session_id_raw else None
        title_val = payload.get("title")
        title = str(title_val).strip() if title_val else None
        prio_str = payload.get("task_priority")
        if status_str and not prio_str:
            prio_str = "MEDIUM"
        elif not status_str:
            prio_str = None
        return Entry(
            id=entity_id,
            user_id=user_id,
            category_id=cat_id,
            title=title,
            occurred_at=_parse_dt(payload.get("occurred_at")),
            content=str(payload.get("content", "")).strip(),
            task_status=TaskStatus(status_str) if status_str else None,
            task_priority=TaskPriority(prio_str) if prio_str else None,
            task_recurrence=TaskRecurrence(rec_str) if rec_str else None,
            capture_session_id=session_id,
            reminder_enabled=bool(payload.get("reminder_enabled")),
            reminder_time=_parse_dt(payload.get("reminder_time")),
            reminder_end_time=_parse_dt(payload.get("reminder_end_time")),
            reminder_recurrence=str(payload.get("reminder_recurrence") or "NONE"),
            reminder_offset_minutes=int(payload.get("reminder_offset_minutes") or 0),
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
            new_cat_id = uuid.UUID(str(payload["category_id"]))
            stmt_cat = select(Category).where(
                Category.id == new_cat_id, Category.user_id == item.user_id
            )
            if db.execute(stmt_cat).scalar_one_or_none() is not None:
                item.category_id = new_cat_id
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

    for entity_type, model_cls in models:
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
        events.append((tb.deleted_at, True, tb, tb.entity_type))

    events.sort(key=lambda x: (_to_comparable_dt(x[0]), str(getattr(x[2], "id", ""))))

    has_more = len(events) > limit
    page_events = events[:limit]

    changes: list[SyncPullChange] = []
    tombstones: list[SyncTombstone] = []
    next_cursor: str | None = None

    for evt_time, is_tb, obj, ent_type in page_events:
        next_cursor = evt_time.isoformat()
        if is_tb:
            tombstones.append(
                SyncTombstone(
                    entity_type=ent_type,
                    entity_id=obj.entity_id,
                    deleted_at=obj.deleted_at.isoformat(),
                    deleted_version=obj.deleted_version,
                )
            )
        else:
            action = SyncAction.CREATE if obj.version == 1 else SyncAction.UPDATE
            changes.append(
                SyncPullChange(
                    entity_type=ent_type,
                    entity_id=obj.id,
                    action=action,
                    payload=_model_to_dict(obj),
                )
            )

    return changes, tombstones, next_cursor, has_more
