from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import CategoryKind

HEX_COLOR_REGEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


class CategoryCreate(BaseModel):
    kind: CategoryKind = CategoryKind.STANDARD
    name: str = Field(min_length=1, max_length=100)
    voice_command: str = Field(min_length=1, max_length=100)
    description: str = Field(
        default="Categoría de usuario", min_length=1, max_length=1000
    )
    color: str = Field(min_length=7, max_length=7)
    icon: str = Field(min_length=1, max_length=100)

    @field_validator("name", "voice_command", "description", "icon", mode="before")
    @classmethod
    def strip_required_strings(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
        return v

    @field_validator("color")
    @classmethod
    def validate_color_hex(cls, v: str) -> str:
        upper_v = v.upper().strip()
        if not HEX_COLOR_REGEX.match(upper_v):
            raise ValueError("Color must be a valid hex RGB format #RRGGBB.")
        return upper_v


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    voice_command: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, min_length=1, max_length=1000)
    color: str | None = Field(default=None, min_length=7, max_length=7)
    icon: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("name", "voice_command", "description", "icon", mode="before")
    @classmethod
    def strip_optional_strings(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
        return v

    @field_validator("color")
    @classmethod
    def validate_optional_color_hex(cls, v: str | None) -> str | None:
        if v is None:
            return None
        upper_v = v.upper().strip()
        if not HEX_COLOR_REGEX.match(upper_v):
            raise ValueError("Color must be a valid hex RGB format #RRGGBB.")
        return upper_v


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    kind: CategoryKind
    name: str
    voice_command: str
    description: str
    color: str
    icon: str
    created_at: datetime
    updated_at: datetime
    version: int
