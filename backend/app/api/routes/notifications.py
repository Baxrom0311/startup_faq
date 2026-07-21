import uuid
import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import func, select

from app.api.deps import CurrentUser, CurrentUserFromQuery, SessionDep
from app.core.db import engine
from sqlmodel import Session

from app.models import (
    Message,
    Notification,
    NotificationPublic,
    NotificationReadRequest,
    NotificationsPublic,
    Problem,
)
from app.modules.notifications.service import mark_notification_read

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationsPublic)
def read_notifications(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 30,
    unread_only: bool = False,
) -> Any:
    filters = [Notification.user_id == current_user.id]
    if unread_only:
        filters.append(Notification.read_at.is_(None))  # type: ignore[attr-defined]

    count = session.exec(
        select(func.count()).select_from(Notification).where(*filters)
    ).one()
    unread_count = session.exec(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))  # type: ignore[attr-defined]
    ).one()
    notifications = session.exec(
        select(Notification)
        .where(*filters)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return NotificationsPublic(
        data=[NotificationPublic.model_validate(notification) for notification in notifications],
        count=count,
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read", response_model=NotificationPublic)
def mark_one_notification_read(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    notification_id: uuid.UUID,
) -> Any:
    notification = session.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    mark_notification_read(session=session, notification=notification)
    session.commit()
    session.refresh(notification)
    return notification


@router.post("/read", response_model=Message)
def mark_notifications_read(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    request: NotificationReadRequest,
) -> Any:
    filters = [Notification.user_id == current_user.id, Notification.read_at.is_(None)]  # type: ignore[attr-defined]
    if request.notification_ids:
        filters.append(Notification.id.in_(request.notification_ids))  # type: ignore[attr-defined]

    notifications = session.exec(select(Notification).where(*filters)).all()
    for notification in notifications:
        mark_notification_read(session=session, notification=notification)
    session.commit()
    return Message(message=f"{len(notifications)} notifications marked as read")


@router.get("/stream")
async def stream_notifications(
    current_user: CurrentUserFromQuery,
    test_once: bool = False,
) -> StreamingResponse:
    async def event_generator():
        last_unread_count = -1
        last_needs_review_count = -1
        while True:
            try:
                with Session(engine) as session:
                    unread_count = session.exec(
                        select(func.count())
                        .select_from(Notification)
                        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))  # type: ignore[attr-defined]
                    ).one()

                    needs_review_count = 0
                    if current_user.is_superuser:
                        needs_review_count = session.exec(
                            select(func.count())
                            .select_from(Problem)
                            .where(Problem.status == "needs_review")
                        ).one()

                    if unread_count != last_unread_count or needs_review_count != last_needs_review_count:
                        last_unread_count = unread_count
                        last_needs_review_count = needs_review_count
                        payload: dict = {"unread_count": unread_count}
                        if current_user.is_superuser:
                            payload["needs_review_count"] = needs_review_count
                        data = json.dumps(payload)
                        yield f"data: {data}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

            if test_once:
                break
            await asyncio.sleep(2.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
