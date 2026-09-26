from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import SaveMode


class SavePreferenceUpdate(BaseModel):
    mode: SaveMode


class SavePreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    mode: SaveMode
    created_at: datetime
    updated_at: datetime
    version: int
