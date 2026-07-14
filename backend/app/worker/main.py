import logging
from urllib.parse import urlparse

from arq.connections import RedisSettings

from app.core.config import settings
from app.worker.tasks.analyze_problem import analyze_problem
from app.worker.tasks.send_notification import send_notification

logger = logging.getLogger(__name__)


def redis_settings_from_url(url: str) -> RedisSettings:
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "redis",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or 0),
        username=parsed.username,
        password=parsed.password,
    )


class WorkerSettings:
    functions = [analyze_problem, send_notification]
    redis_settings = redis_settings_from_url(settings.REDIS_URL)


if __name__ == "__main__":
    logger.info(
        "Run this worker with: arq app.worker.main.WorkerSettings; redis=%s",
        settings.REDIS_URL,
    )
