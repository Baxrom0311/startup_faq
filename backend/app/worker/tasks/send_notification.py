import uuid
from datetime import datetime, timezone

import httpx
from sqlmodel import Session

from app.core.config import settings
from app.core.db import engine
from app.models import Notification, User


def _render_notification_text(notification: Notification) -> str:
    title = notification.payload.get("project_title")
    project_title = title if isinstance(title, str) and title else "Loyiha"
    problem_title = notification.payload.get("title")
    ptitle = problem_title if isinstance(problem_title, str) and problem_title else "Muammo"

    labels = {
        "project.proposed": f"{project_title} bo'yicha yangi taklif keldi.",
        "project.approved": f"{project_title} tasdiqlandi.",
        "project.rejected": f"{project_title} rad etildi.",
        "project.piloting_started": f"{project_title} pilot bosqichiga o'tdi.",
        "project.completed": f"{project_title} yakunlandi.",
        "problem.published": f"\"{ptitle}\" muammongiz nashr qilindi.",
        "problem.archived": f"\"{ptitle}\" muammongiz arxivlandi.",
        "problem.merged": f"\"{ptitle}\" muammongiz mavjud muammoga birlashtirildi.",
    }
    return labels.get(notification.type, notification.type)


async def _send_telegram_message(*, telegram_id: int, text: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"https://api.telegram.org/bot{settings.TG_BOT_TOKEN}/sendMessage",
            json={"chat_id": telegram_id, "text": text},
        )
        response.raise_for_status()


async def send_notification(ctx: dict, notification_id: str) -> None:
    """Deliver a persisted notification to external channels.

    The in-app notification is already durable in PostgreSQL. This task only
    handles Telegram delivery and keeps status on the same notification row.
    """
    _ = ctx
    parsed_notification_id = uuid.UUID(notification_id)
    with Session(engine) as session:
        notification = session.get(Notification, parsed_notification_id)
        if not notification or notification.delivery_status == "delivered":
            return

        user = session.get(User, notification.user_id)
        if not user or not user.telegram_id:
            notification.delivery_status = "skipped"
            notification.delivery_error = "User has no linked Telegram account"
            session.add(notification)
            session.commit()
            return

        if not settings.TG_BOT_TOKEN:
            notification.delivery_status = "skipped"
            notification.delivery_error = "TG_BOT_TOKEN is not configured"
            session.add(notification)
            session.commit()
            return

        try:
            await _send_telegram_message(
                telegram_id=user.telegram_id,
                text=_render_notification_text(notification),
            )
        except Exception as exc:
            notification.delivery_status = "failed"
            notification.delivery_error = str(exc)[:500]
        else:
            notification.delivery_status = "delivered"
            notification.delivered_at = datetime.now(timezone.utc)
            notification.delivery_error = None

        session.add(notification)
        session.commit()
