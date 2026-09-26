from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.domain import User


class InvalidUserDataError(ValueError):
    """Raised when email or password validation fails."""


class UserAlreadyExistsError(ValueError):
    """Raised when attempting to create a user with an already registered email."""


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(email: str) -> str:
    """Normalize email using Unicode NFKC, stripping whitespace, and lowercasing."""
    cleaned = unicodedata.normalize("NFKC", email).strip().lower()
    return " ".join(cleaned.split())


def validate_email(email: str) -> str:
    """Validate and return normalized email. Raise InvalidUserDataError if invalid."""
    if not email or not email.strip():
        raise InvalidUserDataError("Email cannot be empty.")
    normalized = normalize_email(email)
    if not EMAIL_REGEX.match(normalized):
        raise InvalidUserDataError("Invalid email address format.")
    return normalized


def validate_password(password: str) -> None:
    """Validate password strength. Raise InvalidUserDataError if invalid."""
    if not password or not password.strip():
        raise InvalidUserDataError("Password cannot be empty.")
    if len(password) < 8:
        raise InvalidUserDataError("Password must be at least 8 characters long.")


def create_user(db: Session, email: str, password: str) -> User:
    """Create a new user with secure password hash and normalized email."""
    normalized_email = validate_email(email)
    validate_password(password)

    stmt = select(User).where(User.email_normalized == normalized_email)
    existing_user = db.execute(stmt).scalar_one_or_none()
    if existing_user is not None:
        raise UserAlreadyExistsError("A user with this email already exists.")

    now = datetime.now(UTC)
    user = User(
        id=uuid.uuid4(),
        email=email.strip(),
        email_normalized=normalized_email,
        password_hash=hash_password(password),
        created_at=now,
        updated_at=now,
        version=1,
    )
    db.add(user)
    db.flush()
    return user
