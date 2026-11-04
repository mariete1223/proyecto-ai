from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, security_bearer
from app.core.auth import (
    InvalidTokenError,
    create_access_token,
    create_password_reset_token,
    create_verification_token,
    decode_password_reset_token,
    decode_token_for_refresh,
    decode_verification_token,
)
from app.core.rate_limit import RateLimiter
from app.core.security import hash_password, verify_password
from app.models.domain import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.email_service import (
    send_password_reset_email,
    send_verification_email,
)
from app.services.user_service import (
    InvalidUserDataError,
    UserAlreadyExistsError,
    create_user,
    normalize_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])

login_limiter = RateLimiter(max_requests=5, window_seconds=60, scope="auth:login")
register_limiter = RateLimiter(max_requests=5, window_seconds=60, scope="auth:register")
resend_limiter = RateLimiter(max_requests=3, window_seconds=60, scope="auth:resend")
forgot_password_limiter = RateLimiter(
    max_requests=3, window_seconds=60, scope="auth:forgot_password"
)
reset_password_limiter = RateLimiter(
    max_requests=5, window_seconds=60, scope="auth:reset_password"
)


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
    dependencies=[Depends(register_limiter)],
)
def register(
    request: LoginRequest, db: Annotated[Session, Depends(get_db)]
) -> RegisterResponse:
    try:
        user = create_user(db, request.email, request.password, is_verified=False)
        try:
            from app.services.category_service import seed_initial_categories

            seed_initial_categories(db, user.id)
        except Exception:
            pass
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


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(login_limiter)],
)
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


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    dependencies=[Depends(resend_limiter)],
)
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


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[Depends(forgot_password_limiter)],
    summary="Request a password reset link/token",
)
def forgot_password(
    request: ForgotPasswordRequest, db: Annotated[Session, Depends(get_db)]
) -> MessageResponse:
    normalized_email = normalize_email(request.email)
    user = db.execute(
        select(User).where(User.email_normalized == normalized_email)
    ).scalar_one_or_none()

    if user is not None:
        token = create_password_reset_token(user_id=str(user.id), email=user.email)
        send_password_reset_email(user.email, token)

    return MessageResponse(
        message="Si la dirección coincide con una cuenta registrada, recibirás un correo con las instrucciones para restablecer tu contraseña."
    )


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    dependencies=[Depends(reset_password_limiter)],
    summary="Reset account password using a reset token",
)
def reset_password(
    request: ResetPasswordRequest, db: Annotated[Session, Depends(get_db)]
) -> MessageResponse:
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters long.",
        )

    try:
        payload = decode_password_reset_token(request.token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or expired password reset token: {exc}",
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

    user.password_hash = hash_password(request.new_password)
    user.is_verified = True
    user.updated_at = datetime.now(UTC)
    user.version += 1
    db.commit()

    return MessageResponse(
        message="Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión con tu nueva contraseña."
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return UserResponse(id=current_user.id, email=current_user.email)


@router.post("/logout", response_model=MessageResponse)
def logout(
    current_user: Annotated[User, Depends(get_current_user)],
) -> MessageResponse:
    return MessageResponse(message="Successfully logged out.")


@router.post(
    "/refresh", response_model=TokenResponse, summary="Refresh JWT access token"
)
def refresh_token(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(security_bearer)
    ] = None,
    body: Annotated[RefreshTokenRequest | None, Body()] = None,
) -> TokenResponse:
    raw_token: str | None = None
    if credentials is not None and credentials.credentials:
        raw_token = credentials.credentials
    elif request.headers.get("authorization", "").startswith("Bearer "):
        raw_token = request.headers.get("authorization", "")[7:].strip()
    elif body is not None and body.token:
        raw_token = body.token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required to refresh session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token_for_refresh(raw_token)
        user_id_str = payload.get("sub")
        if not user_id_str or not isinstance(user_id_str, str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = uuid.UUID(user_id_str)
    except (InvalidTokenError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Cannot refresh token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address is not verified.",
        )

    new_token = create_access_token(user_id=str(user.id), email=user.email)
    return TokenResponse(access_token=new_token, token_type="bearer")
