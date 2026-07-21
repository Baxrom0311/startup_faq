from typing import Any
import json
from fastapi import APIRouter
from sqlmodel import select

from app.api.deps import SessionDep, RedisDep
from app.models import Region

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("/", response_model=list[Region])
async def list_regions(session: SessionDep, redis: RedisDep) -> Any:
    cache_key = "regions:list"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    results = session.exec(select(Region).where(Region.parent_id.is_(None)).order_by(Region.id)).all()
    data = [r.model_dump() for r in results]

    try:
        await redis.setex(cache_key, 60, json.dumps(data))
    except Exception:
        pass

    return results
