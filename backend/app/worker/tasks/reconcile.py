"""Reconciliation sweep.

Best-effort enqueues (AI analysis, notification delivery) silently drop jobs when
Redis is briefly unavailable. This periodic task re-enqueues work that has been
stuck past a grace period so nothing is lost permanently.
"""
import logging
from datetime import datetime, timedelta, timezone

from arq import create_pool
from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.models import Notification, Problem

logger = logging.getLogger(__name__)

# Only re-enqueue work older than this, so we never race the normal path.
STUCK_GRACE_MINUTES = 15
BATCH_LIMIT = 200


async def reconcile_stuck_jobs(ctx: dict) -> dict[str, int]:
    _ = ctx
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=STUCK_GRACE_MINUTES)
    requeued_problems = 0
    requeued_notifications = 0

    with Session(engine) as session:
        stuck_problems = session.exec(
            select(Problem.id)
            .where(Problem.status == "ai_processing")
            .where(Problem.updated_at < cutoff)
            .limit(BATCH_LIMIT)
        ).all()
        stuck_notifications = session.exec(
            select(Notification.id)
            .where(Notification.delivery_status == "pending")
            .where(Notification.created_at < cutoff)
            .limit(BATCH_LIMIT)
        ).all()

    if not stuck_problems and not stuck_notifications:
        return {"problems": 0, "notifications": 0}

    # Deferred import avoids a circular import with app.worker.main.
    from app.worker.main import redis_settings_from_url

    redis = await create_pool(redis_settings_from_url(settings.REDIS_URL))
    try:
        for problem_id in stuck_problems:
            await redis.enqueue_job("analyze_problem", str(problem_id))
            requeued_problems += 1
        for notification_id in stuck_notifications:
            await redis.enqueue_job("send_notification", str(notification_id))
            requeued_notifications += 1
    finally:
        await redis.aclose()

    logger.info(
        "Reconciliation re-enqueued %d problems and %d notifications",
        requeued_problems,
        requeued_notifications,
    )
    return {"problems": requeued_problems, "notifications": requeued_notifications}
