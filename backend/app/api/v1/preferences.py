from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.preference import SavePreferenceResponse, SavePreferenceUpdate
from app.services.preference_service import (
    get_save_preference,
    update_save_preference,
)

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("/save-mode", response_model=SavePreferenceResponse)
def get_user_save_preference(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SavePreferenceResponse:
    pref = get_save_preference(db, current_user.id)
    return SavePreferenceResponse.model_validate(pref)


@router.put("/save-mode", response_model=SavePreferenceResponse)
def update_user_save_preference(
    data: SavePreferenceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SavePreferenceResponse:
    updated_pref = update_save_preference(db, current_user.id, data.mode)
    return SavePreferenceResponse.model_validate(updated_pref)
