from __future__ import annotations

import asyncio
import logging
import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.vapid import send_web_push_detail
from app.db.session import get_database_engine
from app.models.domain import Entry, PushSubscription

logger = logging.getLogger(__name__)


def check_and_send_due_reminders(db: Session) -> int:
    """Check database for due reminders and send Web Push notifications to active devices."""
    now = datetime.now(UTC)
    # Window: due up to 30 seconds in future or within last 30 minutes
    window_future = now + timedelta(seconds=30)
    window_past = now - timedelta(minutes=30)

    stmt = select(Entry).where(
        Entry.reminder_enabled == True,  # noqa: E712
    )
    entries = db.execute(stmt).scalars().all()

    sent_count = 0
    for entry in entries:
        # Determine effective trigger time
        trigger_dt: datetime | None = None
        offset_mins = entry.reminder_offset_minutes or 0

        if offset_mins > 0:
            base_dt = entry.occurred_at or entry.reminder_time
            if base_dt is not None:
                trigger_dt = base_dt - timedelta(minutes=offset_mins)
        else:
            trigger_dt = entry.reminder_time or entry.occurred_at

        if trigger_dt is None:
            continue

        if trigger_dt.tzinfo is None:
            trigger_dt = trigger_dt.replace(tzinfo=UTC)
        else:
            trigger_dt = trigger_dt.astimezone(UTC)

        # Si el recordatorio ya pasó hace más de 30 minutos (completamente vencido y no entregado):
        if trigger_dt < window_past:
            rec = entry.reminder_recurrence or "NONE"
            if rec == "NONE":
                entry.reminder_enabled = False
                entry.updated_at = now
                entry.version = (entry.version or 1) + 1
            else:
                delta: timedelta | None = None
                hour_match = re.match(r"^EVERY_(\d+)_HOURS?$", rec)
                if hour_match:
                    delta = timedelta(hours=int(hour_match.group(1)))
                elif rec == "DAILY":
                    delta = timedelta(days=1)
                elif rec == "WEEKLY":
                    delta = timedelta(days=7)
                elif rec == "MONTHLY":
                    delta = timedelta(days=30)

                if delta is not None:
                    next_trigger = (entry.reminder_time or trigger_dt) + delta
                    if entry.reminder_end_time is not None:
                        end_dt = entry.reminder_end_time
                        if end_dt.tzinfo is None:
                            end_dt = end_dt.replace(tzinfo=UTC)
                        else:
                            end_dt = end_dt.astimezone(UTC)
                        if next_trigger > end_dt:
                            entry.reminder_enabled = False
                        else:
                            if entry.occurred_at is not None:
                                entry.occurred_at = entry.occurred_at + delta
                            entry.reminder_time = next_trigger
                    else:
                        if entry.occurred_at is not None:
                            entry.occurred_at = entry.occurred_at + delta
                        entry.reminder_time = next_trigger
                else:
                    entry.reminder_enabled = False

                entry.updated_at = now
                entry.version = (entry.version or 1) + 1
            continue

        # Is it due?
        if window_past <= trigger_dt <= window_future:
            # Check if reached reminder_end_time
            if entry.reminder_end_time is not None:
                end_dt = entry.reminder_end_time
                if end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=UTC)
                else:
                    end_dt = end_dt.astimezone(UTC)
                if now > end_dt:
                    entry.reminder_enabled = False
                    entry.updated_at = now
                    entry.version = (entry.version or 1) + 1
                    continue

            # Fetch user's push subscriptions
            sub_stmt = select(PushSubscription).where(
                PushSubscription.user_id == entry.user_id
            )
            subs = db.execute(sub_stmt).scalars().all()

            notif_title = f"🔔 {entry.title.strip() if entry.title and entry.title.strip() else 'Recordatorio de Proyecto AI'}"
            notif_body = entry.content.strip()[:140]

            expired_sub_ids = []
            for sub in subs:
                sub_info = {
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth,
                    },
                }
                success, is_expired = send_web_push_detail(
                    sub_info,
                    {
                        "title": notif_title,
                        "body": notif_body,
                        "tag": f"entry-reminder-{entry.id}",
                        "url": "/",
                    },
                )
                if success:
                    sent_count += 1
                elif is_expired:
                    expired_sub_ids.append(sub.id)

            if expired_sub_ids:
                db.execute(
                    delete(PushSubscription).where(
                        PushSubscription.id.in_(expired_sub_ids)
                    )
                )

            # Advance recurrence or disable
            rec = entry.reminder_recurrence or "NONE"
            delta: timedelta | None = None
            hour_match = re.match(r"^EVERY_(\d+)_HOURS?$", rec)
            if hour_match:
                hours = int(hour_match.group(1))
                delta = timedelta(hours=hours)
            elif rec == "DAILY":
                delta = timedelta(days=1)
            elif rec == "WEEKLY":
                delta = timedelta(days=7)
            elif rec == "MONTHLY":
                delta = timedelta(days=30)

            if delta is not None:
                next_trigger = (entry.reminder_time or trigger_dt) + delta
                # If reminder_end_time is set, check if next_trigger exceeds it
                if entry.reminder_end_time is not None:
                    end_dt = entry.reminder_end_time
                    if end_dt.tzinfo is None:
                        end_dt = end_dt.replace(tzinfo=UTC)
                    else:
                        end_dt = end_dt.astimezone(UTC)
                    if next_trigger > end_dt:
                        entry.reminder_enabled = False
                    else:
                        if entry.occurred_at is not None:
                            entry.occurred_at = entry.occurred_at + delta
                        entry.reminder_time = next_trigger
                else:
                    if entry.occurred_at is not None:
                        entry.occurred_at = entry.occurred_at + delta
                    entry.reminder_time = next_trigger
            else:
                entry.reminder_enabled = False

            entry.updated_at = now
            entry.version = (entry.version or 1) + 1

    if sent_count > 0 or len(entries) > 0:
        db.commit()

    return sent_count


async def run_reminder_push_loop(interval_seconds: int = 30) -> None:
    """Continuous background loop checking for due reminders every interval_seconds."""
    engine = get_database_engine()
    logger.info(
        "Iniciando background worker de Web Push (intervalo: %ds)...", interval_seconds
    )

    while True:
        try:
            with Session(engine) as session:
                check_and_send_due_reminders(session)
        except Exception as exc:
            logger.warning("Error en el ciclo del worker de Web Push: %s", exc)

        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            logger.info("Worker de Web Push detenido.")
            break
