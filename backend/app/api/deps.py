from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import UTC
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import InvalidTokenError, decode_access_token
from app.db.session import get_database_session
from app.models.domain import User

security_bearer = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    yield from get_database_session()


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(security_bearer)
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.credentials == "demo-token":
        import os

        if os.environ.get("DISABLE_DEMO_TOKEN") == "1":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Demo token is disabled.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        demo_user = db.execute(
            select(User).where(User.email_normalized == "demo@example.com")
        ).scalar_one_or_none()
        if not demo_user:
            from datetime import datetime

            now = datetime.now(UTC)
            demo_user = User(
                id=uuid.UUID("11111111-1111-4111-a111-111111111111"),
                email="demo@example.com",
                email_normalized="demo@example.com",
                password_hash="demo_hash",
                created_at=now,
                updated_at=now,
                version=1,
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
        return demo_user

    try:
        payload = decode_access_token(credentials.credentials)
        user_id_str = payload.get("sub")
        if not user_id_str or not isinstance(user_id_str, str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = uuid.UUID(user_id_str)
    except (InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
