import asyncio
import logging
from uuid import UUID

from arq import create_pool

from app.core.config import settings
from app.worker.main import redis_settings_from_url

logger = logging.getLogger(__name__)


async def enqueue_analyze_problem(problem_id: UUID) -> None:
    redis = await create_pool(redis_settings_from_url(settings.REDIS_URL))
    try:
        await redis.enqueue_job("analyze_problem", str(problem_id))
    finally:
        await redis.aclose()


def enqueue_analyze_problem_best_effort(problem_id: UUID) -> None:
    try:
        asyncio.run(enqueue_analyze_problem(problem_id))
    except Exception:
        logger.exception("Failed to enqueue analyze_problem for problem_id=%s", problem_id)
