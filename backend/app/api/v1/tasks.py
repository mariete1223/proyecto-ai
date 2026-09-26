from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.entry import (
    EntryResponse,
    PaginatedEntriesResponse,
    TaskStatusUpdate,
)
from app.services.entry_service import (
    EntryNotFoundError,
    InvalidEntryDataError,
    list_pending_dateless_tasks,
    update_task_status,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/pending", response_model=PaginatedEntriesResponse)
def get_pending_dateless_tasks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedEntriesResponse:
    try:
        results, total = list_pending_dateless_tasks(
            db=db,
            user_id=current_user.id,
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


@router.patch("/{entry_id}/status", response_model=EntryResponse)
def update_entry_task_status(
    entry_id: uuid.UUID,
    data: TaskStatusUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EntryResponse:
    try:
        updated_entry, tag_ids = update_task_status(
            db, current_user.id, entry_id, data.task_status
        )
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
