import re
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

HEX_COLOR_REGEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, min_length=7, max_length=7)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
        return v

    @field_validator("color")
    @classmethod
    def validate_color_hex(cls, v: str | None) -> str | None:
        if v is None:
            return None
        upper_v = v.upper().strip()
        if not HEX_COLOR_REGEX.match(upper_v):
            raise ValueError("Color must be a valid hex RGB format #RRGGBB.")
        return upper_v


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, min_length=7, max_length=7)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
        return v

    @field_validator("color")
    @classmethod
    def validate_color_hex(cls, v: str | None) -> str | None:
        if v is None:
            return None
        upper_v = v.upper().strip()
        if not HEX_COLOR_REGEX.match(upper_v):
            raise ValueError("Color must be a valid hex RGB format #RRGGBB.")
        return upper_v


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    color: str
    created_at: datetime
    updated_at: datetime
    version: int
