import uuid

from app.models import Notification
from app.modules.notifications.service import (
    create_notification,
    mark_notification_read,
)
from app.worker.tasks.send_notification import _render_notification_text


class DummySession:
    def __init__(self) -> None:
        self.objects: list[object] = []

    def add(self, obj: object) -> None:
        self.objects.append(obj)


def test_create_notification_adds_inbox_item() -> None:
    session = DummySession()
    user_id = uuid.uuid4()

    notification = create_notification(
        session=session,  # type: ignore[arg-type]
        user_id=user_id,
        type="project.approved",
        payload={"project_id": str(uuid.uuid4())},
    )

    assert notification.user_id == user_id
    assert notification.type == "project.approved"
    assert session.objects == [notification]


def test_mark_notification_read_sets_timestamp_once() -> None:
    session = DummySession()
    notification = Notification(user_id=uuid.uuid4(), type="project.completed")

    mark_notification_read(session=session, notification=notification)  # type: ignore[arg-type]
    first_read_at = notification.read_at
    mark_notification_read(session=session, notification=notification)  # type: ignore[arg-type]

    assert notification.read_at is not None
    assert notification.read_at == first_read_at


def test_render_notification_text_uses_project_title() -> None:
    notification = Notification(
        user_id=uuid.uuid4(),
        type="project.approved",
        payload={"project_title": "Agro pilot"},
    )

    assert _render_notification_text(notification) == "Agro pilot tasdiqlandi."


def test_render_notification_text_problem_published() -> None:
    notification = Notification(
        user_id=uuid.uuid4(),
        type="problem.published",
        payload={"problem_id": str(uuid.uuid4()), "title": "Sug'orish tizimi"},
    )

    text = _render_notification_text(notification)
    assert "Sug'orish tizimi" in text
    assert "nashr" in text


def test_render_notification_text_problem_merged() -> None:
    notification = Notification(
        user_id=uuid.uuid4(),
        type="problem.merged",
        payload={"problem_id": str(uuid.uuid4()), "title": "Yo'l muammosi"},
    )

    text = _render_notification_text(notification)
    assert "Yo'l muammosi" in text
    assert "birlashtirildi" in text
