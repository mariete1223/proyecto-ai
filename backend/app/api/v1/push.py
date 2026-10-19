from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.vapid import get_vapid_public_key, send_web_push
from app.models.domain import PushSubscription, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["push"])


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    user_agent: str | None = None


class PushSubscribeResponse(BaseModel):
    status: str = "ok"
    subscription_id: str


class PushTestRequest(BaseModel):
    title: str = Field(default="🔔 Prueba de Notificación Push")
    body: str = Field(
        default="¡Las notificaciones en segundo plano están funcionando perfectamente!"
    )


class PushTestResponse(BaseModel):
    status: str = "ok"
    sent_count: int


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
def get_public_key() -> VapidPublicKeyResponse:
    """Return the VAPID uncompressed public key (base64url) for Web Push subscription."""
    key = get_vapid_public_key()
    return VapidPublicKeyResponse(public_key=key)


@router.post("/subscribe", response_model=PushSubscribeResponse)
def subscribe_push(
    data: PushSubscriptionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PushSubscribeResponse:
    """Register or update a Web Push subscription for the authenticated user."""
    endpoint = data.endpoint.strip()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Endpoint cannot be blank."
        )

    now = datetime.now(UTC)
    stmt = select(PushSubscription).where(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == endpoint,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    if existing is not None:
        existing.p256dh = data.keys.p256dh
        existing.auth = data.keys.auth
        existing.user_agent = data.user_agent
        existing.updated_at = now
        sub_id = str(existing.id)
    else:
        new_id = uuid.uuid4()
        new_sub = PushSubscription(
            id=new_id,
            user_id=current_user.id,
            endpoint=endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
            user_agent=data.user_agent,
            created_at=now,
            updated_at=now,
        )
        db.add(new_sub)
        sub_id = str(new_id)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(stmt).scalar_one_or_none()
        if existing is not None:
            existing.p256dh = data.keys.p256dh
            existing.auth = data.keys.auth
            existing.user_agent = data.user_agent
            existing.updated_at = now
            sub_id = str(existing.id)
            db.commit()
        else:
            raise

    logger.info(
        "Suscripción Push registrada para usuario %s: %s", current_user.id, sub_id
    )
    return PushSubscribeResponse(status="ok", subscription_id=sub_id)


@router.post("/test", response_model=PushTestResponse)
def test_push_notification(
    data: PushTestRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PushTestResponse:
    """Send an immediate test push notification to all active devices of the user."""
    stmt = select(PushSubscription).where(PushSubscription.user_id == current_user.id)
    subs = db.execute(stmt).scalars().all()

    sent_count = 0
    expired_ids: list[uuid.UUID] = []

    for sub in subs:
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth,
            },
        }
        success = send_web_push(
            sub_info,
            {
                "title": data.title,
                "body": data.body,
                "tag": f"test-push-{int(datetime.now().timestamp())}",
                "url": "/",
            },
        )
        if success:
            sent_count += 1
        else:
            # Check if dead endpoint
            expired_ids.append(sub.id)

    if expired_ids:
        db.execute(delete(PushSubscription).where(PushSubscription.id.in_(expired_ids)))
        db.commit()

    return PushTestResponse(status="ok", sent_count=sent_count)
