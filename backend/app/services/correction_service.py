from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import CaptureCorrection, Entry
from app.schemas.correction import CaptureCorrectionCreate


class InvalidCorrectionDataError(ValueError):
    """Raised when capture correction data or session link is invalid."""


class CorrectionNotFoundError(ValueError):
    """Raised when capture correction is not found."""


def create_capture_correction(
    db: Session, user_id: uuid.UUID, data: CaptureCorrectionCreate
) -> CaptureCorrection:
    """Register a capture interpretation correction linked to an entry and session."""
    stmt_entry = select(Entry).where(
        Entry.id == data.entry_id, Entry.user_id == user_id
    )
    entry = db.execute(stmt_entry).scalar_one_or_none()
    if entry is None:
        raise InvalidCorrectionDataError("Entry not found or does not belong to user.")

    if (
        entry.capture_session_id is None
        or entry.capture_session_id != data.capture_session_id
    ):
        raise InvalidCorrectionDataError(
            "Capture session ID does not match entry capture session."
        )

    stmt_existing = select(CaptureCorrection).where(
        CaptureCorrection.entry_id == data.entry_id,
        CaptureCorrection.capture_session_id == data.capture_session_id,
        CaptureCorrection.field == data.field,
    )
    if db.execute(stmt_existing).scalar_one_or_none() is not None:
        raise InvalidCorrectionDataError(
            "Correction for this field already exists for this capture session."
        )

    now = datetime.now(UTC)
    correction = CaptureCorrection(
        id=uuid.uuid4(),
        user_id=user_id,
        entry_id=data.entry_id,
        capture_session_id=data.capture_session_id,
        field=data.field,
        interpreted_value=data.interpreted_value,
        accepted_value=data.accepted_value,
        created_at=now,
        updated_at=now,
        version=1,
    )
    db.add(correction)
    db.flush()
    return correction


def list_capture_corrections(
    db: Session, user_id: uuid.UUID, entry_id: uuid.UUID | None = None
) -> list[CaptureCorrection]:
    """List capture corrections owned by user."""
    stmt = select(CaptureCorrection).where(CaptureCorrection.user_id == user_id)
    if entry_id is not None:
        stmt = stmt.where(CaptureCorrection.entry_id == entry_id)
    stmt = stmt.order_by(CaptureCorrection.created_at.desc(), CaptureCorrection.id)
    return list(db.execute(stmt).scalars().all())
