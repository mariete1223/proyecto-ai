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


def create_user(
    db: Session, email: str, password: str, is_verified: bool = True
) -> User:
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
        is_verified=is_verified,
        created_at=now,
        updated_at=now,
        version=1,
    )
    db.add(user)
    db.flush()
    return user


def delete_user_account(db: Session, user_id: uuid.UUID) -> None:
    """Delete a user and all related personal data atomically (GDPR Art. 17)."""
    from sqlalchemy import delete

    from app.models.domain import (
        CaptureCorrection,
        Category,
        DeletionTombstone,
        Entry,
        EntryTag,
        PushSubscription,
        SavePreference,
        Tag,
    )

    # 1. Delete push subscriptions
    db.execute(delete(PushSubscription).where(PushSubscription.user_id == user_id))
    # 2. Delete capture corrections
    db.execute(delete(CaptureCorrection).where(CaptureCorrection.user_id == user_id))
    # 3. Delete entry tags
    entry_ids_subq = select(Entry.id).where(Entry.user_id == user_id)
    db.execute(delete(EntryTag).where(EntryTag.entry_id.in_(entry_ids_subq)))
    tag_ids_subq = select(Tag.id).where(Tag.user_id == user_id)
    db.execute(delete(EntryTag).where(EntryTag.tag_id.in_(tag_ids_subq)))
    # 4. Delete entries
    db.execute(delete(Entry).where(Entry.user_id == user_id))
    # 5. Delete tags
    db.execute(delete(Tag).where(Tag.user_id == user_id))
    # 6. Delete categories
    db.execute(delete(Category).where(Category.user_id == user_id))
    # 7. Delete save preferences
    db.execute(delete(SavePreference).where(SavePreference.user_id == user_id))
    # 8. Delete deletion tombstones
    db.execute(delete(DeletionTombstone).where(DeletionTombstone.user_id == user_id))
    # 9. Delete user
    db.execute(delete(User).where(User.id == user_id))
    db.commit()
