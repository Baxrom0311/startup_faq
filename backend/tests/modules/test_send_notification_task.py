import asyncio
import uuid
from typing import Any

from app.models import Notification, User
from app.worker.tasks import send_notification

# ---------------------------------------------------------------------------
# DummySession – mirrors the pattern in test_cleanup_media_task.py
# ---------------------------------------------------------------------------

class DummySession:
    """Minimal session stub that serves pre-loaded objects from .get() calls."""

    def __init__(self, objects: dict[tuple[type, Any], Any]) -> None:
        self._objects = objects
        self.added: list[Any] = []
        self.committed = False

    def __enter__(self) -> "DummySession":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def get(self, model: type, ident: Any) -> Any:
        return self._objects.get((model, ident))

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    def commit(self) -> None:
        self.committed = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_notification(
    *,
    user_id: uuid.UUID | None = None,
    delivery_status: str = "pending",
) -> Notification:
    return Notification(
        id=uuid.uuid4(),
        user_id=user_id or uuid.uuid4(),
        type="project.approved",
        payload={"project_title": "TestProject"},
        delivery_status=delivery_status,
    )


def _make_user(
    *,
    user_id: uuid.UUID,
    telegram_id: int | None = 123456,
) -> User:
    return User(
        id=user_id,
        email=f"{uuid.uuid4().hex[:8]}@test.com",
        hashed_password="xxx",
        telegram_id=telegram_id,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_send_notification_delivers_via_telegram(monkeypatch) -> None:
    """Happy path: notification exists, user has telegram_id, TG_BOT_TOKEN set."""
    notif = _make_notification()
    user = _make_user(user_id=notif.user_id, telegram_id=999)
    session = DummySession({
        (Notification, notif.id): notif,
        (User, user.id): user,
    })

    telegram_calls: list[dict] = []

    async def fake_send(*, telegram_id: int, text: str) -> None:
        telegram_calls.append({"telegram_id": telegram_id, "text": text})

    monkeypatch.setattr(send_notification, "Session", lambda engine: session)
    monkeypatch.setattr(send_notification, "settings", type("S", (), {"TG_BOT_TOKEN": "tok123"})())
    monkeypatch.setattr(send_notification, "_send_telegram_message", fake_send)

    asyncio.run(send_notification.send_notification({}, str(notif.id)))

    assert notif.delivery_status == "delivered"
    assert notif.delivered_at is not None
    assert notif.delivery_error is None
    assert len(telegram_calls) == 1
    assert telegram_calls[0]["telegram_id"] == 999
    assert session.committed


def test_send_notification_skips_when_no_telegram_id(monkeypatch) -> None:
    """User has no telegram_id → delivery_status should be 'skipped'."""
    notif = _make_notification()
    user = _make_user(user_id=notif.user_id, telegram_id=None)
    session = DummySession({
        (Notification, notif.id): notif,
        (User, user.id): user,
    })

    telegram_calls: list[dict] = []

    async def fake_send(*, telegram_id: int, text: str) -> None:
        telegram_calls.append({"telegram_id": telegram_id, "text": text})

    monkeypatch.setattr(send_notification, "Session", lambda engine: session)
    monkeypatch.setattr(send_notification, "settings", type("S", (), {"TG_BOT_TOKEN": "tok123"})())
    monkeypatch.setattr(send_notification, "_send_telegram_message", fake_send)

    asyncio.run(send_notification.send_notification({}, str(notif.id)))

    assert notif.delivery_status == "skipped"
    assert len(telegram_calls) == 0
    assert session.committed


def test_send_notification_skips_when_no_bot_token(monkeypatch) -> None:
    """TG_BOT_TOKEN is empty → delivery_status should be 'skipped'."""
    notif = _make_notification()
    user = _make_user(user_id=notif.user_id, telegram_id=999)
    session = DummySession({
        (Notification, notif.id): notif,
        (User, user.id): user,
    })

    telegram_calls: list[dict] = []

    async def fake_send(*, telegram_id: int, text: str) -> None:
        telegram_calls.append({"telegram_id": telegram_id, "text": text})

    monkeypatch.setattr(send_notification, "Session", lambda engine: session)
    monkeypatch.setattr(send_notification, "settings", type("S", (), {"TG_BOT_TOKEN": ""})())
    monkeypatch.setattr(send_notification, "_send_telegram_message", fake_send)

    asyncio.run(send_notification.send_notification({}, str(notif.id)))

    assert notif.delivery_status == "skipped"
    assert len(telegram_calls) == 0
    assert session.committed


def test_send_notification_handles_telegram_api_error(monkeypatch) -> None:
    """_send_telegram_message raises → delivery_status='failed', delivery_error set."""
    notif = _make_notification()
    user = _make_user(user_id=notif.user_id, telegram_id=999)
    session = DummySession({
        (Notification, notif.id): notif,
        (User, user.id): user,
    })

    async def fail_send(*, telegram_id: int, text: str) -> None:  # noqa: ARG001
        raise RuntimeError("Telegram API is down")

    monkeypatch.setattr(send_notification, "Session", lambda engine: session)
    monkeypatch.setattr(send_notification, "settings", type("S", (), {"TG_BOT_TOKEN": "tok123"})())
    monkeypatch.setattr(send_notification, "_send_telegram_message", fail_send)

    asyncio.run(send_notification.send_notification({}, str(notif.id)))

    assert notif.delivery_status == "failed"
    assert notif.delivery_error is not None
    assert "Telegram API is down" in notif.delivery_error
    assert notif.delivered_at is None
    assert session.committed


def test_send_notification_skips_already_delivered(monkeypatch) -> None:
    """Notification already delivered → no Telegram call made, early return."""
    notif = _make_notification(delivery_status="delivered")
    session = DummySession({
        (Notification, notif.id): notif,
    })

    telegram_calls: list[dict] = []

    async def fake_send(*, telegram_id: int, text: str) -> None:
        telegram_calls.append({"telegram_id": telegram_id, "text": text})

    monkeypatch.setattr(send_notification, "Session", lambda engine: session)
    monkeypatch.setattr(send_notification, "_send_telegram_message", fake_send)

    asyncio.run(send_notification.send_notification({}, str(notif.id)))

    assert len(telegram_calls) == 0
    # Session was never committed because we returned early
    assert not session.committed
