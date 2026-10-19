from __future__ import annotations

import re
import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.auth import create_access_token
from app.main import app
from app.models.domain import Category, Entry, PushSubscription, User
from app.services.push_worker import check_and_send_due_reminders
from app.services.user_service import create_user


@pytest.fixture
def test_db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def register_sqlite_functions(
        dbapi_connection: Any, connection_record: Any
    ) -> None:
        dbapi_connection.create_function(
            "btrim", 1, lambda val: val.strip() if val is not None else None
        )
        dbapi_connection.create_function(
            "char_length", 1, lambda val: len(val) if val is not None else 0
        )
        dbapi_connection.create_function(
            "regexp",
            2,
            lambda expr, item: bool(re.search(expr, item)) if item else False,
        )

    User.metadata.create_all(
        bind=engine,
        tables=[
            cast(Table, User.__table__),
            cast(Table, Category.__table__),
            cast(Table, Entry.__table__),
            cast(Table, PushSubscription.__table__),
        ],
    )
    TestingSessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(test_db_session: Session) -> Generator[TestClient, None, None]:
    def _override_get_db() -> Generator[Session, None, None]:
        yield test_db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(test_db_session: Session) -> User:
    return create_user(test_db_session, "pushuser@example.com", "Password123!")


@pytest.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    token = create_access_token(user_id=str(test_user.id), email=test_user.email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def default_category(test_db_session: Session, test_user: User) -> Category:
    cat = Category(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="General",
        name_normalized="general",
        voice_command="general",
        voice_command_normalized="general",
        description="General Category",
        color="#2563EB",
        icon="folder",
        kind="STANDARD",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        version=1,
    )
    test_db_session.add(cat)
    test_db_session.commit()
    return cat


def test_get_vapid_public_key(client: TestClient) -> None:
    res = client.get("/api/v1/push/vapid-public-key")
    assert res.status_code == 200
    data = res.json()
    assert "public_key" in data
    assert len(data["public_key"]) > 50


def test_subscribe_push_endpoint(
    client: TestClient,
    test_user: User,
    auth_headers: dict[str, str],
    test_db_session: Session,
) -> None:
    endpoint = "https://fcm.googleapis.com/fcm/send/test-sub-123"
    keys_dict = {
        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0A3qcVIi6109968853",
        "auth": "tBHItJI5svbpez7KI4CCXg",
    }
    payload = {
        "endpoint": endpoint,
        "keys": keys_dict,
        "user_agent": "Mozilla/5.0 Test",
    }

    # 1. Without auth
    res_unauth = client.post("/api/v1/push/subscribe", json=payload)
    assert res_unauth.status_code == 401

    # 2. With auth
    res = client.post("/api/v1/push/subscribe", json=payload, headers=auth_headers)
    assert res.status_code == 200
    sub_data = res.json()
    assert sub_data["status"] == "ok"
    assert "subscription_id" in sub_data

    # Check DB
    sub = (
        test_db_session.query(PushSubscription)
        .filter(PushSubscription.endpoint == endpoint)
        .first()
    )
    assert sub is not None
    assert sub.user_id == test_user.id
    assert sub.p256dh == keys_dict["p256dh"]


def test_push_test_endpoint(
    client: TestClient,
    test_user: User,
    auth_headers: dict[str, str],
    test_db_session: Session,
) -> None:
    # Add subscription
    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=test_user.id,
        endpoint="https://web.push.apple.com/test-endpoint",
        p256dh="test_p256dh",
        auth="test_auth",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    test_db_session.add(sub)
    test_db_session.commit()

    with patch("app.api.v1.push.send_web_push", return_value=True) as mock_send:
        res = client.post(
            "/api/v1/push/test",
            json={"title": "Test Title", "body": "Test Body"},
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["sent_count"] == 1
        mock_send.assert_called_once()


def test_check_and_send_due_reminders(
    test_db_session: Session,
    test_user: User,
    default_category: Category,
) -> None:
    now = datetime.now(UTC)
    # 1. Create a due entry
    entry = Entry(
        id=uuid.uuid4(),
        user_id=test_user.id,
        category_id=default_category.id,
        content="Reunión importante",
        title="Reunión",
        occurred_at=now,
        reminder_enabled=True,
        reminder_time=now,
        reminder_recurrence="NONE",
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(entry)

    # 2. Add push subscription
    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=test_user.id,
        endpoint="https://fcm.googleapis.com/fcm/send/entry-test",
        p256dh="key_p256",
        auth="auth_key",
        created_at=now,
        updated_at=now,
    )
    test_db_session.add(sub)
    test_db_session.commit()

    with patch(
        "app.services.push_worker.send_web_push_detail", return_value=(True, False)
    ) as mock_push:
        sent = check_and_send_due_reminders(test_db_session)
        assert sent == 1
        mock_push.assert_called_once()

    # Verify reminder_enabled was set to False since recurrence is NONE
    test_db_session.refresh(entry)
    assert entry.reminder_enabled is False


def test_send_web_push_key_and_claims(
    test_db_session: Session,
    test_user: User,
) -> None:
    import os
    from unittest.mock import MagicMock

    from app.core.vapid import send_web_push_detail

    sub_info = {
        "endpoint": "https://web.push.apple.com/test-endpoint",
        "keys": {"p256dh": "dummy_p256", "auth": "dummy_auth"},
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 201

    with patch("app.core.vapid.webpush", return_value=mock_resp) as mock_webpush:
        success, is_expired = send_web_push_detail(sub_info, {"title": "Test Title"})
        assert success is True
        assert is_expired is False
        mock_webpush.assert_called_once()
        _, kwargs = mock_webpush.call_args

        # Crucial: vapid_private_key must be a valid file path, not a raw PEM string
        key_arg = kwargs.get("vapid_private_key")
        assert key_arg is not None
        assert os.path.isfile(key_arg), f"Expected file path, got {key_arg}"
        assert not str(key_arg).startswith("-----BEGIN")

        # Claims must have valid mailto subject
        claims = kwargs.get("vapid_claims")
        assert claims is not None
        assert claims.get("sub", "").startswith("mailto:")

        # APNs lock screen headers and high urgency
        hdrs = kwargs.get("headers")
        assert hdrs is not None
        assert hdrs.get("apns-priority") == "10"
        assert hdrs.get("apns-push-type") == "alert"
        assert hdrs.get("Urgency") == "high"

        # TTL must be 86400 (24 hours) for lock screen background delivery
        assert kwargs.get("ttl") == 86400


def test_transient_error_preserves_subscription(
    test_db_session: Session,
    test_user: User,
    default_category: Category,
) -> None:
    now = datetime.now(UTC)
    entry = Entry(
        id=uuid.uuid4(),
        user_id=test_user.id,
        category_id=default_category.id,
        content="Tarea no eliminable por fallo transitorio",
        title="Importante",
        occurred_at=now,
        reminder_enabled=True,
        reminder_time=now,
        reminder_recurrence="NONE",
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(entry)

    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=test_user.id,
        endpoint="https://web.push.apple.com/endpoint-transient",
        p256dh="key_p256",
        auth="auth_key",
        created_at=now,
        updated_at=now,
    )
    test_db_session.add(sub)
    test_db_session.commit()

    # Simulate transient error (e.g. 500 Internal Server Error or network timeout: is_expired=False)
    with patch(
        "app.services.push_worker.send_web_push_detail", return_value=(False, False)
    ):
        sent = check_and_send_due_reminders(test_db_session)
        assert sent == 0

    # The subscription MUST NOT be deleted on transient errors!
    db_sub = (
        test_db_session.query(PushSubscription)
        .filter(PushSubscription.id == sub.id)
        .first()
    )
    assert db_sub is not None


def test_check_and_send_due_reminders_with_offset(
    test_db_session: Session,
    test_user: User,
    default_category: Category,
) -> None:
    now = datetime.now(UTC)
    event_time = now + timedelta(minutes=60)

    # 1. Entry with event in 60 min and offset of 60 min -> trigger_dt is NOW (due!)
    due_entry = Entry(
        id=uuid.uuid4(),
        user_id=test_user.id,
        category_id=default_category.id,
        content="Evento hoy a las 17:30 con aviso 1h antes",
        title="Revisión médica",
        occurred_at=event_time,
        reminder_enabled=True,
        reminder_time=event_time,  # populated with event time
        reminder_offset_minutes=60,
        reminder_recurrence="NONE",
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(due_entry)

    # 2. Entry with event in 60 min and offset of 15 min -> trigger_dt is in 45 min (NOT due!)
    future_entry = Entry(
        id=uuid.uuid4(),
        user_id=test_user.id,
        category_id=default_category.id,
        content="Evento futuro",
        title="Dentista",
        occurred_at=event_time,
        reminder_enabled=True,
        reminder_time=event_time,
        reminder_offset_minutes=15,
        reminder_recurrence="NONE",
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(future_entry)

    # Push subscription
    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=test_user.id,
        endpoint="https://web.push.apple.com/offset-test",
        p256dh="key_p256",
        auth="auth_key",
        created_at=now,
        updated_at=now,
    )
    test_db_session.add(sub)
    test_db_session.commit()

    with patch(
        "app.services.push_worker.send_web_push_detail", return_value=(True, False)
    ) as mock_push:
        sent = check_and_send_due_reminders(test_db_session)
        assert sent == 1
        mock_push.assert_called_once()
        # Verify the due entry was sent and disabled
        test_db_session.refresh(due_entry)
        assert due_entry.reminder_enabled is False

        # Verify the future entry was NOT touched
        test_db_session.refresh(future_entry)
        assert future_entry.reminder_enabled is True


def test_check_and_send_due_reminders_hourly_recurrence(
    test_db_session: Session,
    test_user: User,
    default_category: Category,
) -> None:
    now = datetime.now(UTC)
    entry = Entry(
        id=uuid.uuid4(),
        user_id=test_user.id,
        category_id=default_category.id,
        content="Pastilla cada 4 horas",
        title="Medicación",
        occurred_at=now,
        reminder_enabled=True,
        reminder_time=now,
        reminder_recurrence="EVERY_4_HOURS",
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(entry)

    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=test_user.id,
        endpoint="https://web.push.apple.com/hourly-rec-test",
        p256dh="key_p256",
        auth="auth_key",
        created_at=now,
        updated_at=now,
    )
    test_db_session.add(sub)
    test_db_session.commit()

    with patch(
        "app.services.push_worker.send_web_push_detail", return_value=(True, False)
    ):
        sent = check_and_send_due_reminders(test_db_session)
        assert sent == 1

    test_db_session.refresh(entry)
    assert entry.reminder_enabled is True
    assert entry.reminder_time is not None
    # SQLite TIMESTAMP may return naive datetime; compare normalized to UTC
    entry_rt = (
        entry.reminder_time
        if entry.reminder_time.tzinfo
        else entry.reminder_time.replace(tzinfo=UTC)
    )
    assert entry_rt == now + timedelta(hours=4)


def test_check_and_send_due_reminders_hourly_cutoff_at_end_time(
    test_db_session: Session,
    test_user: User,
    default_category: Category,
) -> None:
    now = datetime.now(UTC)
    # End time is only 2 hours from now, but cycle is 4 hours
    end_time = now + timedelta(hours=2)

    entry = Entry(
        id=uuid.uuid4(),
        user_id=test_user.id,
        category_id=default_category.id,
        content="Aviso con fecha fin superada",
        title="Tratamiento",
        occurred_at=now,
        reminder_enabled=True,
        reminder_time=now,
        reminder_end_time=end_time,
        reminder_recurrence="EVERY_4_HOURS",
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(entry)

    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=test_user.id,
        endpoint="https://web.push.apple.com/hourly-cutoff-test",
        p256dh="key_p256",
        auth="auth_key",
        created_at=now,
        updated_at=now,
    )
    test_db_session.add(sub)
    test_db_session.commit()

    with patch(
        "app.services.push_worker.send_web_push_detail", return_value=(True, False)
    ):
        sent = check_and_send_due_reminders(test_db_session)
        assert sent == 1

    test_db_session.refresh(entry)
    # Should be disabled because next cycle (now + 4h) exceeds reminder_end_time (now + 2h)
    assert entry.reminder_enabled is False


def test_push_worker_window_past_and_expiration(
    test_db_session: Session,
    test_user: User,
    default_category: Category,
) -> None:
    """Test that reminders up to 30 min in past are processed, and reminders > 30 min are deactivated."""
    from datetime import timedelta

    now = datetime.now(UTC)

    # 1. Entry due 15 minutes ago (within 30-min window)
    due_entry = Entry(
        id=uuid.uuid4(),
        user_id=test_user.id,
        category_id=default_category.id,
        content="Recordatorio reciente 15 min",
        occurred_at=now - timedelta(minutes=15),
        reminder_enabled=True,
        reminder_time=now - timedelta(minutes=15),
        reminder_recurrence="NONE",
        created_at=now - timedelta(minutes=20),
        updated_at=now - timedelta(minutes=20),
        version=1,
    )
    # 2. Entry due 45 minutes ago (outside 30-min window -> expired)
    expired_entry = Entry(
        id=uuid.uuid4(),
        user_id=test_user.id,
        category_id=default_category.id,
        content="Recordatorio antiguo 45 min",
        occurred_at=now - timedelta(minutes=45),
        reminder_enabled=True,
        reminder_time=now - timedelta(minutes=45),
        reminder_recurrence="NONE",
        created_at=now - timedelta(minutes=50),
        updated_at=now - timedelta(minutes=50),
        version=1,
    )
    test_db_session.add(due_entry)
    test_db_session.add(expired_entry)

    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=test_user.id,
        endpoint="https://web.push.apple.com/window-past-test",
        p256dh="key_p256",
        auth="auth_key",
        created_at=now,
        updated_at=now,
    )
    test_db_session.add(sub)
    test_db_session.commit()

    with patch(
        "app.services.push_worker.send_web_push_detail", return_value=(True, False)
    ) as mock_send:
        sent = check_and_send_due_reminders(test_db_session)
        assert sent == 1
        assert mock_send.call_count == 1

    test_db_session.refresh(due_entry)
    test_db_session.refresh(expired_entry)

    # due_entry was sent and deactivated (since NONE recurrence)
    assert due_entry.reminder_enabled is False
    # expired_entry was not sent but deactivated to avoid perpetual queries
    assert expired_entry.reminder_enabled is False


def test_push_worker_uuid_serialization_and_send_detail(
    test_db_session: Session,
    test_user: User,
    default_category: Category,
) -> None:
    """Test that check_and_send_due_reminders formats entry_id as string and send_web_push_detail serializes UUIDs cleanly (#93)."""
    now = datetime.now(UTC)
    entry_uuid = uuid.uuid4()
    entry = Entry(
        id=entry_uuid,
        user_id=test_user.id,
        category_id=default_category.id,
        content="Recordatorio prueba UUID serialization",
        occurred_at=now,
        reminder_enabled=True,
        reminder_time=now,
        reminder_recurrence="NONE",
        created_at=now,
        updated_at=now,
        version=1,
    )
    test_db_session.add(entry)

    sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=test_user.id,
        endpoint="https://web.push.apple.com/uuid-test",
        p256dh="key_p256",
        auth="auth_key",
        created_at=now,
        updated_at=now,
    )
    test_db_session.add(sub)
    test_db_session.commit()

    with patch(
        "app.services.push_worker.send_web_push_detail", return_value=(True, False)
    ) as mock_send:
        sent = check_and_send_due_reminders(test_db_session)
        assert sent == 1
        assert mock_send.call_count == 1
        # Inspect payload passed to send_web_push_detail
        args, kwargs = mock_send.call_args
        payload = args[1]
        assert payload["entry_id"] == str(entry_uuid)
        assert isinstance(payload["entry_id"], str)
        assert payload["tag"] == f"entry-reminder-{entry_uuid}"

    # Also directly test send_web_push_detail handles raw UUID in data without raising TypeError
    from app.core.vapid import send_web_push_detail

    sub_info = {
        "endpoint": "https://web.push.apple.com/direct-uuid-test",
        "keys": {"p256dh": "key", "auth": "auth"},
    }
    with patch("app.core.vapid.webpush", return_value=None):
        success, is_expired = send_web_push_detail(
            sub_info,
            {"title": "Test", "entry_id": entry_uuid, "nested": {"id": uuid.uuid4()}},
        )
        assert success is True
        assert is_expired is False


def test_push_subscribe_duplicate_endpoint_concurrency(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    """Test that subscribing with the same endpoint repeatedly or concurrently updates gracefully (#93)."""
    payload = {
        "endpoint": "https://web.push.apple.com/duplicate-test-endpoint",
        "keys": {"p256dh": "p256dh_key_1", "auth": "auth_key_1"},
        "user_agent": "Mozilla/5.0 Test Browser 1",
    }

    # First subscribe call
    res1 = client.post("/api/v1/push/subscribe", json=payload, headers=auth_headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "ok"
    sub_id_1 = data1["subscription_id"]

    # Second subscribe call with updated keys (e.g. concurrent or repeated)
    payload["keys"]["auth"] = "auth_key_updated"
    payload["user_agent"] = "Mozilla/5.0 Test Browser 2"
    res2 = client.post("/api/v1/push/subscribe", json=payload, headers=auth_headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "ok"
    assert data2["subscription_id"] == sub_id_1

