from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.domain import User
from app.schemas.correction import (
    CaptureCorrectionCreate,
    CaptureCorrectionResponse,
)
from app.services.correction_service import (
    InvalidCorrectionDataError,
    create_capture_correction,
    list_capture_corrections,
)

router = APIRouter(prefix="/corrections", tags=["corrections"])


@router.post(
    "", response_model=CaptureCorrectionResponse, status_code=status.HTTP_201_CREATED
)
def create_new_capture_correction(
    data: CaptureCorrectionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CaptureCorrectionResponse:
    try:
        correction = create_capture_correction(db, current_user.id, data)
        return CaptureCorrectionResponse.model_validate(correction)
    except InvalidCorrectionDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("", response_model=list[CaptureCorrectionResponse])
def get_user_capture_corrections(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    entry_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[CaptureCorrectionResponse]:
    corrections = list_capture_corrections(db, current_user.id, entry_id=entry_id)
    return [CaptureCorrectionResponse.model_validate(c) for c in corrections]
