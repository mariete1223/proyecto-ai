from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.entry import (
    EntryCreate,
    EntryResponse,
    EntryUpdate,
    PaginatedEntriesResponse,
)
from app.services.entry_service import (
    EntryNotFoundError,
    InvalidEntryDataError,
    create_entry,
    delete_entry,
    get_entry_by_id,
    list_entries,
    update_entry,
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


@router.get("", response_model=PaginatedEntriesResponse)
def get_user_entries(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    start_at: Annotated[datetime | None, Query()] = None,
    end_at: Annotated[datetime | None, Query()] = None,
    category_ids: Annotated[list[uuid.UUID] | None, Query()] = None,
    tag_ids: Annotated[list[uuid.UUID] | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedEntriesResponse:
    try:
        results, total = list_entries(
            db=db,
            user_id=current_user.id,
            start_at=start_at,
            end_at=end_at,
            category_ids=category_ids,
            tag_ids=tag_ids,
            page=page,
            limit=limit,
        )
        items: list[EntryResponse] = []
        for entry, t_ids in results:
            item = EntryResponse.model_validate(entry)
            item.tag_ids = t_ids
            items.append(item)

        has_more = (page * limit) < total
        return PaginatedEntriesResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            has_more=has_more,
        )
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


@router.put("/{entry_id}", response_model=EntryResponse)
def update_user_entry(
    entry_id: uuid.UUID,
    data: EntryUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EntryResponse:
    try:
        updated_entry, tag_ids = update_entry(db, current_user.id, entry_id, data)
        response_data = EntryResponse.model_validate(updated_entry)
        response_data.tag_ids = tag_ids
        return response_data
    except EntryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except InvalidEntryDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_entry(
    entry_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    try:
        delete_entry(db, current_user.id, entry_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except EntryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
