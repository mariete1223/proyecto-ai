from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
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
    TaskRecurrence,
    TaskStatus,
    TombstoneEntity,
)
from app.schemas.sync import (
    PushResultStatus,
    SyncAction,
    SyncClientChange,
    SyncPushChangeResult,
)
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
            d[col.name] = val.isoformat()
        elif hasattr(val, "value"):  # Enum
            d[col.name] = val.value
        else:
            d[col.name] = val
    return d


def _parse_dt(val: Any) -> datetime | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    return None


def process_sync_push(
    db: Session, user_id: uuid.UUID, client_changes: list[SyncClientChange]
) -> list[SyncPushChangeResult]:
    """Process a batch of client push changes idempotently."""
    results: list[SyncPushChangeResult] = []

    for change in client_changes:
        try:
            res = _process_single_change(db, user_id, change)
            results.append(res)
        except Exception as exc:
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
            change.entity_type, user_id, change.entity_id, change.payload, now
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

        if existing_item.version == change.base_version:
            new_version = existing_item.version + 1
            _update_domain_model(
                existing_item, change.entity_type, change.payload, now, new_version
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
    entity_type: TombstoneEntity,
    user_id: uuid.UUID,
    entity_id: uuid.UUID,
    payload: dict[str, Any],
    now: datetime,
) -> Any:
    if entity_type == TombstoneEntity.CATEGORY:
        name = str(payload.get("name", "")).strip()
        voice_command = str(payload.get("voice_command", "")).strip()
        kind_str = payload.get("kind", "STANDARD")
        return Category(
            id=entity_id,
            user_id=user_id,
            kind=CategoryKind(kind_str),
            name=name,
            name_normalized=normalize_text_key(name),
            voice_command=voice_command,
            voice_command_normalized=normalize_text_key(voice_command),
            description=str(payload.get("description") or "Category description"),
            color=str(payload.get("color", "#000000")).upper(),
            icon=str(payload.get("icon", "folder")),
            created_at=now,
            updated_at=now,
            version=1,
        )
    elif entity_type == TombstoneEntity.TAG:
        name = str(payload.get("name", "")).strip()
        return Tag(
            id=entity_id,
            user_id=user_id,
            name=name,
            name_normalized=normalize_tag_name(name),
            created_at=now,
            updated_at=now,
            version=1,
        )
    elif entity_type == TombstoneEntity.ENTRY:
        status_str = payload.get("task_status")
        rec_str = payload.get("task_recurrence")
        cat_id_raw = payload.get("category_id")
        cat_id = uuid.UUID(cat_id_raw) if cat_id_raw else entity_id
        session_id_raw = payload.get("capture_session_id")
        session_id = uuid.UUID(session_id_raw) if session_id_raw else None
        return Entry(
            id=entity_id,
            user_id=user_id,
            category_id=cat_id,
            occurred_at=_parse_dt(payload.get("occurred_at")),
            content=str(payload.get("content", "")).strip(),
            task_status=TaskStatus(status_str) if status_str else None,
            task_recurrence=TaskRecurrence(rec_str) if rec_str else None,
            capture_session_id=session_id,
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
    elif entity_type == TombstoneEntity.ENTRY:
        if "content" in payload:
            item.content = str(payload["content"]).strip()
        if "category_id" in payload:
            item.category_id = uuid.UUID(str(payload["category_id"]))
        if "occurred_at" in payload:
            item.occurred_at = _parse_dt(payload["occurred_at"])
        if "task_status" in payload:
            status_val = payload["task_status"]
            item.task_status = TaskStatus(status_val) if status_val else None
        if "task_recurrence" in payload:
            rec_val = payload["task_recurrence"]
            item.task_recurrence = TaskRecurrence(rec_val) if rec_val else None
    elif entity_type == TombstoneEntity.SAVE_PREFERENCE:
        if "mode" in payload:
            item.mode = SaveMode(payload["mode"])

    item.updated_at = now
    item.version = new_version
