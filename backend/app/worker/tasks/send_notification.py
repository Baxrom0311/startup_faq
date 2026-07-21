import uuid
from datetime import datetime, timezone

import httpx
from sqlmodel import Session

from app.core.config import settings
from app.core.db import engine
from app.models import Notification, User


_LABELS: dict[str, dict[str, str]] = {
    "uz": {
        "project.proposed": "{project} bo'yicha yangi taklif keldi.",
        "project.approved": "{project} tasdiqlandi.",
        "project.rejected": "{project} rad etildi.",
        "project.piloting_started": "{project} pilot bosqichiga o'tdi.",
        "project.completed": "{project} yakunlandi.",
        "problem.published": '"{problem}" muammongiz nashr qilindi.',
        "problem.archived": '"{problem}" muammongiz arxivlandi.',
        "problem.merged": '"{problem}" muammongiz mavjud muammoga birlashtirildi.',
    },
    "ru": {
        "project.proposed": "Поступило новое предложение по проекту «{project}».",
        "project.approved": "Проект «{project}» одобрен.",
        "project.rejected": "Проект «{project}» отклонён.",
        "project.piloting_started": "Проект «{project}» перешёл в стадию пилотирования.",
        "project.completed": "Проект «{project}» завершён.",
        "problem.published": 'Ваша проблема «{problem}» опубликована.',
        "problem.archived": 'Ваша проблема «{problem}» архивирована.',
        "problem.merged": 'Ваша проблема «{problem}» объединена с существующей.',
    },
    "en": {
        "project.proposed": "A new proposal for «{project}» has been submitted.",
        "project.approved": "Project «{project}» has been approved.",
        "project.rejected": "Project «{project}» has been rejected.",
        "project.piloting_started": "Project «{project}» has entered the piloting stage.",
        "project.completed": "Project «{project}» has been completed.",
        "problem.published": 'Your problem "{problem}" has been published.',
        "problem.archived": 'Your problem "{problem}" has been archived.',
        "problem.merged": 'Your problem "{problem}" has been merged with an existing one.',
    },
}


def _render_notification_text(notification: Notification, lang: str = "uz") -> str:
    from app.core.config import settings

    title = notification.payload.get("project_title")
    project_title = title if isinstance(title, str) and title else "Loyiha"
    problem_title = notification.payload.get("title")
    ptitle = problem_title if isinstance(problem_title, str) and problem_title else "Muammo"

    locale = lang if lang in _LABELS else "uz"
    template = _LABELS[locale].get(notification.type, notification.type)
    text = template.format(project=project_title, problem=ptitle)

    # Build a deep link to the relevant page
    base = settings.FRONTEND_HOST.rstrip("/")
    project_id = notification.payload.get("project_id")
    problem_id = notification.payload.get("problem_id")
    target_problem_id = notification.payload.get("target_problem_id")

    if notification.type == "problem.merged" and target_problem_id:
        text += f"\n\n{base}/problems/{target_problem_id}"
    elif project_id:
        text += f"\n\n{base}/projects/{project_id}"
    elif problem_id:
        text += f"\n\n{base}/problems/{problem_id}"

    return text


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
                text=_render_notification_text(notification, lang=user.language or "uz"),
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
