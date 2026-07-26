import logging
from urllib.parse import urlparse

from arq import cron
from arq.connections import RedisSettings

from app.core.config import settings
from app.worker.tasks.analyze_problem import analyze_problem
from app.worker.tasks.cleanup_media import cleanup_orphan_media
from app.worker.tasks.cleanup_sessions import cleanup_expired_sessions
from app.worker.tasks.reconcile import reconcile_stuck_jobs
from app.worker.tasks.send_broadcast import send_broadcast
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
    functions = [
        analyze_problem,
        send_notification,
        cleanup_orphan_media,
        send_broadcast,
        cleanup_expired_sessions,
        reconcile_stuck_jobs,
    ]
    cron_jobs = [
        cron(cleanup_orphan_media, hour=3, minute=0),
        cron(cleanup_expired_sessions, hour=3, minute=30),
        # Re-enqueue AI analysis / notifications lost during a Redis outage.
        cron(reconcile_stuck_jobs, minute={0, 30}),
    ]
    redis_settings = redis_settings_from_url(settings.REDIS_URL)
    # Long-running jobs (large broadcasts, first Whisper model load) need more
    # than arq's 300s default; retries are bounded so a poison job can't loop.
    job_timeout = 600
    max_tries = 4
    keep_result = 3600


if __name__ == "__main__":
    logger.info(
        "Run this worker with: arq app.worker.main.WorkerSettings; redis=%s",
        settings.REDIS_URL,
    )
