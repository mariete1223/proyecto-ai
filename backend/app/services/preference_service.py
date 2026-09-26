from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import SavePreference
from app.models.enums import SaveMode


def get_save_preference(db: Session, user_id: uuid.UUID) -> SavePreference:
    """Retrieve save preference for user, creating a default FAST_FORWARD row if absent."""
    stmt = select(SavePreference).where(SavePreference.user_id == user_id)
    pref = db.execute(stmt).scalar_one_or_none()
    if pref is None:
        now = datetime.now(UTC)
        pref = SavePreference(
            id=uuid.uuid4(),
            user_id=user_id,
            mode=SaveMode.FAST_FORWARD,
            created_at=now,
            updated_at=now,
            version=1,
        )
        db.add(pref)
        db.flush()
    return pref


def update_save_preference(
    db: Session, user_id: uuid.UUID, mode: SaveMode
) -> SavePreference:
    """Update save preference mode for user."""
    pref = get_save_preference(db, user_id)
    if pref.mode != mode:
        pref.mode = mode
        pref.updated_at = datetime.now(UTC)
        pref.version += 1
        db.flush()
    return pref
