from typing import Any

from fastapi import APIRouter
from sqlmodel import select

from app.api.deps import SessionDep
from app.models import Region

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("/", response_model=list[Region])
def list_regions(session: SessionDep) -> Any:
    return session.exec(select(Region).where(Region.parent_id.is_(None)).order_by(Region.id)).all()
