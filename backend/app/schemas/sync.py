from __future__ import annotations

from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import TombstoneEntity


class SyncAction(StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class PushResultStatus(StrEnum):
    APPLIED = "APPLIED"
    ALREADY_APPLIED = "ALREADY_APPLIED"
    CONFLICT = "CONFLICT"
    REJECTED = "REJECTED"


class SyncClientChange(BaseModel):
    change_id: UUID
    entity_type: TombstoneEntity
    entity_id: UUID
    action: SyncAction
    base_version: int
    payload: dict[str, Any] = {}


class SyncPushChangeResult(BaseModel):
    change_id: UUID
    entity_type: TombstoneEntity
    entity_id: UUID
    status: PushResultStatus
    applied_version: int | None = None
    server_entity: dict[str, Any] | None = None
    error_message: str | None = None


class SyncPushRequest(BaseModel):
    client_changes: list[SyncClientChange]


class SyncPushResponse(BaseModel):
    results: list[SyncPushChangeResult]
