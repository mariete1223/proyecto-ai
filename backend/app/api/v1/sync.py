from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.sync import SyncPushRequest, SyncPushResponse
from app.services.sync_service import process_sync_push

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushResponse)
def push_client_changes(
    data: SyncPushRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SyncPushResponse:
    results = process_sync_push(db, current_user.id, data.client_changes)
    return SyncPushResponse(results=results)
