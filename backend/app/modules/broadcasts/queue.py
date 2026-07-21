import asyncio
import logging
from uuid import UUID

from arq import create_pool

from app.core.config import settings
from app.worker.main import redis_settings_from_url

logger = logging.getLogger(__name__)


async def enqueue_broadcast_delivery(broadcast_id: UUID) -> None:
    redis = await create_pool(redis_settings_from_url(settings.REDIS_URL))
    try:
        await redis.enqueue_job("send_broadcast", str(broadcast_id))
    finally:
        await redis.aclose()


def enqueue_broadcast_delivery_best_effort(broadcast_id: UUID) -> None:
    try:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(enqueue_broadcast_delivery(broadcast_id))
        except RuntimeError:
            asyncio.run(enqueue_broadcast_delivery(broadcast_id))
    except Exception:
        logger.exception("Failed to enqueue send_broadcast for broadcast_id=%s", broadcast_id)
