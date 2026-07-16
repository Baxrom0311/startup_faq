from typing import Any

from fastapi import APIRouter
from sqlmodel import select

from app.api.deps import SessionDep
from app.models import Sector

router = APIRouter(prefix="/sectors", tags=["sectors"])


@router.get("/", response_model=list[Sector])
def list_sectors(session: SessionDep) -> Any:
    return session.exec(select(Sector).order_by(Sector.id)).all()
