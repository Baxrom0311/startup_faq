import asyncio
import logging
from uuid import UUID

from arq import create_pool

from app.core.config import settings
from app.worker.main import redis_settings_from_url

logger = logging.getLogger(__name__)


async def enqueue_notification_delivery(notification_id: UUID) -> None:
    redis = await create_pool(redis_settings_from_url(settings.REDIS_URL))
    try:
        await redis.enqueue_job("send_notification", str(notification_id))
    finally:
        await redis.aclose()


def enqueue_notification_delivery_best_effort(notification_id: UUID) -> None:
    try:
        asyncio.run(enqueue_notification_delivery(notification_id))
    except Exception:
        logger.exception("Failed to enqueue send_notification for notification_id=%s", notification_id)
