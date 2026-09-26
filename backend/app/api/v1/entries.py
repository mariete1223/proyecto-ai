from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.entry import EntryCreate, EntryResponse
from app.services.entry_service import (
    EntryNotFoundError,
    InvalidEntryDataError,
    create_entry,
    get_entry_by_id,
)

router = APIRouter(prefix="/entries", tags=["entries"])


@router.post("", response_model=EntryResponse, status_code=status.HTTP_201_CREATED)
def create_new_entry(
    data: EntryCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EntryResponse:
    try:
        entry, tag_ids = create_entry(db, current_user.id, data)
        response_data = EntryResponse.model_validate(entry)
        response_data.tag_ids = tag_ids
        return response_data
    except InvalidEntryDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/{entry_id}", response_model=EntryResponse)
def get_user_entry_by_id(
    entry_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EntryResponse:
    try:
        entry, tag_ids = get_entry_by_id(db, current_user.id, entry_id)
        response_data = EntryResponse.model_validate(entry)
        response_data.tag_ids = tag_ids
        return response_data
    except EntryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
