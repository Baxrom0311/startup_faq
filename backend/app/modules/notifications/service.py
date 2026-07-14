import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session

from app.models import Notification


def create_notification(
    *,
    session: Session,
    user_id: uuid.UUID,
    type: str,
    payload: dict[str, Any] | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type,
        payload=payload or {},
    )
    session.add(notification)
    return notification


def mark_notification_read(
    *,
    session: Session,
    notification: Notification,
) -> Notification:
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        session.add(notification)
    return notification
