from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.auth import create_access_token
from app.core.security import verify_password
from app.models.domain import User
from app.schemas.auth import LoginRequest, MessageResponse, TokenResponse, UserResponse
from app.services.user_service import normalize_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest, db: Annotated[Session, Depends(get_db)]
) -> TokenResponse:
    normalized_email = normalize_email(request.email)
    user = db.execute(
        select(User).where(User.email_normalized == normalized_email)
    ).scalar_one_or_none()

    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user_id=str(user.id), email=user.email)
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return UserResponse(id=current_user.id, email=current_user.email)


@router.post("/logout", response_model=MessageResponse)
def logout(
    current_user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    return MessageResponse(message="Successfully logged out.")
