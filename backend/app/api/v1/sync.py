from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.sync import (
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.sync_service import process_sync_pull, process_sync_push

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushResponse)
def push_client_changes(
    data: SyncPushRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SyncPushResponse:
    results = process_sync_push(db, current_user.id, data.client_changes)
    return SyncPushResponse(results=results)


@router.get("/pull", response_model=SyncPullResponse)
def pull_server_changes(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    cursor: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SyncPullResponse:
    try:
        changes, tombstones, next_cursor, has_more = process_sync_pull(
            db, current_user.id, cursor_str=cursor, limit=limit
        )
        return SyncPullResponse(
            changes=changes,
            tombstones=tombstones,
            next_cursor=next_cursor,
            has_more=has_more,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
