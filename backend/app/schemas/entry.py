from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import TaskRecurrence, TaskStatus


class EntryCreate(BaseModel):
    category_id: UUID
    occurred_at: datetime | None = None
    content: str = Field(min_length=1, max_length=10000)
    tag_ids: list[UUID] = Field(default_factory=list)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
        return v


class EntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    category_id: UUID
    occurred_at: datetime | None
    content: str
    task_status: TaskStatus | None = None
    task_recurrence: TaskRecurrence | None = None
    capture_session_id: UUID | None = None
    tag_ids: list[UUID] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    version: int


class PaginatedEntriesResponse(BaseModel):
    items: list[EntryResponse]
    total: int
    page: int
    limit: int
    has_more: bool
