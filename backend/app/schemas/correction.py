from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import CorrectionField


class CaptureCorrectionCreate(BaseModel):
    entry_id: UUID
    capture_session_id: UUID
    field: CorrectionField
    interpreted_value: Any | None = None
    accepted_value: Any | None = None


class CaptureCorrectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    entry_id: UUID
    capture_session_id: UUID
    field: CorrectionField
    interpreted_value: Any | None = None
    accepted_value: Any | None = None
    created_at: datetime
    updated_at: datetime
    version: int
