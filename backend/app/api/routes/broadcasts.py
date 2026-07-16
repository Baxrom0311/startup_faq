import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import (
    Broadcast,
    BroadcastCreate,
    BroadcastPublic,
    BroadcastsPublic,
    BroadcastUpdate,
    Message,
)
from app.modules.broadcasts.queue import enqueue_broadcast_delivery_best_effort

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])


@router.post("/", response_model=BroadcastPublic, dependencies=[Depends(get_current_active_superuser)])
def create_broadcast(*, session: SessionDep, broadcast_in: BroadcastCreate) -> Broadcast:
    broadcast = Broadcast.model_validate(broadcast_in)
    session.add(broadcast)
    session.commit()
    session.refresh(broadcast)
    return broadcast


@router.get("/", response_model=BroadcastsPublic, dependencies=[Depends(get_current_active_superuser)])
def read_broadcasts(*, session: SessionDep, skip: int = 0, limit: int = 100) -> BroadcastsPublic:
    count_statement = select(func.count()).select_from(Broadcast)
    count = session.exec(count_statement).one()
    
    statement = select(Broadcast).order_by(Broadcast.created_at.desc()).offset(skip).limit(limit)
    broadcasts = session.exec(statement).all()
    
    return BroadcastsPublic(data=broadcasts, count=count)


@router.get("/{id}", response_model=BroadcastPublic, dependencies=[Depends(get_current_active_superuser)])
def read_broadcast(*, session: SessionDep, id: uuid.UUID) -> Broadcast:
    broadcast = session.get(Broadcast, id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return broadcast


@router.patch("/{id}", response_model=BroadcastPublic, dependencies=[Depends(get_current_active_superuser)])
def update_broadcast(
    *, session: SessionDep, id: uuid.UUID, broadcast_in: BroadcastUpdate
) -> Broadcast:
    broadcast = session.get(Broadcast, id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    if broadcast.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Cannot update a broadcast that has already started or completed",
        )
    
    update_dict = broadcast_in.model_dump(exclude_unset=True)
    broadcast.sqlmodel_update(update_dict)
    session.add(broadcast)
    session.commit()
    session.refresh(broadcast)
    return broadcast


@router.post("/{id}/send", response_model=Message, dependencies=[Depends(get_current_active_superuser)])
def send_broadcast_api(*, session: SessionDep, id: uuid.UUID) -> Message:
    broadcast = session.get(Broadcast, id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    if broadcast.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Broadcast is already in sending or completed status",
        )
    
    enqueue_broadcast_delivery_best_effort(broadcast.id)
    return Message(message="Broadcast sending enqueued in background")


@router.delete("/{id}", response_model=Message, dependencies=[Depends(get_current_active_superuser)])
def delete_broadcast(*, session: SessionDep, id: uuid.UUID) -> Message:
    broadcast = session.get(Broadcast, id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    if broadcast.status == "sending":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a broadcast that is currently sending",
        )
    
    session.delete(broadcast)
    session.commit()
    return Message(message="Broadcast deleted successfully")
