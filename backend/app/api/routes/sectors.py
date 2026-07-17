from typing import Any
import json
from fastapi import APIRouter
from sqlmodel import select

from app.api.deps import SessionDep, RedisDep
from app.models import Sector

router = APIRouter(prefix="/sectors", tags=["sectors"])


@router.get("/", response_model=list[Sector])
async def list_sectors(session: SessionDep, redis: RedisDep) -> Any:
    cache_key = "sectors:list"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    results = session.exec(select(Sector).order_by(Sector.id)).all()
    data = [s.model_dump() for s in results]

    try:
        await redis.setex(cache_key, 60, json.dumps(data))
    except Exception:
        pass

    return results
