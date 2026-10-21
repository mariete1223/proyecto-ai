from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.auth import (
    InvalidTokenError,
    create_access_token,
    create_verification_token,
    decode_verification_token,
)
from app.core.security import verify_password
from app.models.domain import User
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RegisterResponse,
    ResendVerificationRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.email_service import send_verification_email
from app.services.user_service import (
    InvalidUserDataError,
    UserAlreadyExistsError,
    create_user,
    normalize_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _execute_email_verification(token: str, db: Session) -> MessageResponse:
    try:
        payload = decode_verification_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or expired verification token: {exc}",
        ) from None

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token payload.",
        )
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID in token.",
        ) from None

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found.",
        )

    if not user.is_verified:
        user.is_verified = True
        user.updated_at = datetime.now(UTC)
        user.version += 1
        db.commit()

    return MessageResponse(message="Email successfully verified. You may now log in.")


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(
    request: LoginRequest, db: Annotated[Session, Depends(get_db)]
) -> RegisterResponse:
    try:
        user = create_user(db, request.email, request.password, is_verified=False)
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        ) from None
    except InvalidUserDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from None

    token = create_verification_token(user_id=str(user.id), email=user.email)
    send_verification_email(user.email, token)

    return RegisterResponse(
        message="Account created successfully. Please check your email to verify your account before logging in.",
        email=user.email,
    )


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

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address is not verified. Please check your inbox or request a new confirmation email.",
        )

    access_token = create_access_token(user_id=str(user.id), email=user.email)
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.post("/verify-email", response_model=MessageResponse)
def verify_email_post(
    request: VerifyEmailRequest, db: Annotated[Session, Depends(get_db)]
) -> MessageResponse:
    return _execute_email_verification(request.token, db)


@router.get("/verify-email", response_model=MessageResponse)
def verify_email_get(
    token: str, db: Annotated[Session, Depends(get_db)]
) -> MessageResponse:
    return _execute_email_verification(token, db)


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    request: ResendVerificationRequest, db: Annotated[Session, Depends(get_db)]
) -> MessageResponse:
    normalized_email = normalize_email(request.email)
    user = db.execute(
        select(User).where(User.email_normalized == normalized_email)
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email not found.",
        )

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is already verified.",
        )

    token = create_verification_token(user_id=str(user.id), email=user.email)
    send_verification_email(user.email, token)

    return MessageResponse(message="Verification email sent. Please check your inbox.")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return UserResponse(id=current_user.id, email=current_user.email)


@router.post("/logout", response_model=MessageResponse)
def logout(
    current_user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    return MessageResponse(message="Successfully logged out.")
