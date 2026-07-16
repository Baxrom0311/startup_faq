import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import text

from app.api.deps import SessionDep
from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def liveness() -> dict[str, str]:
    """Liveness probe — always returns 200 if the process is up."""
    return {"status": "ok"}


@router.get("/ready")
def readiness(session: SessionDep) -> JSONResponse:
    """Readiness probe — checks PostgreSQL and Redis connectivity."""
    db_ok = True
    redis_ok = True

    try:
        session.exec(text("SELECT 1"))  # type: ignore[arg-type]
    except Exception:
        db_ok = False

    try:
        async def _ping_redis() -> bool:
            r = Redis.from_url(settings.REDIS_URL)
            try:
                return await r.ping()
            finally:
                await r.aclose()

        asyncio.run(_ping_redis())
    except Exception:
        redis_ok = False

    payload = {
        "status": "ok" if (db_ok and redis_ok) else "unavailable",
        "db": db_ok,
        "redis": redis_ok,
    }
    status_code = 200 if (db_ok and redis_ok) else 503
    return JSONResponse(content=payload, status_code=status_code)
