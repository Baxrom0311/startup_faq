import asyncio
import uuid
from typing import Any

from arq import create_pool
from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import Message, ProblemMedia
from app.modules.media.schemas import PresignRequest, PresignResponse
from app.modules.media.service import (
    build_object_key,
    create_presigned_upload_url,
    validate_media,
)
from app.worker.main import redis_settings_from_url

router = APIRouter(prefix="/media", tags=["media"])

MAX_ORPHAN_UPLOADS_PER_USER = 20


@router.post("/presign", response_model=PresignResponse)
def presign_media_upload(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    body: PresignRequest,
) -> Any:
    orphan_count = session.exec(
        select(func.count()).where(
            ProblemMedia.uploaded_by == current_user.id,
            ProblemMedia.problem_id.is_(None),  # type: ignore[union-attr]
            ProblemMedia.project_update_id.is_(None),  # type: ignore[union-attr]
        )
    ).one()
    if orphan_count >= MAX_ORPHAN_UPLOADS_PER_USER:
        raise HTTPException(
            status_code=429,
            detail="Too many pending uploads. Finish or cancel existing uploads first.",
        )
    validate_media(kind=body.kind, content_type=body.content_type, size=body.size)
    object_key = build_object_key(kind=body.kind, content_type=body.content_type)
    problem_id = uuid.UUID(body.problem_id) if body.problem_id else None
    media = ProblemMedia(
        problem_id=problem_id,
        uploaded_by=current_user.id,
        kind=body.kind,
        object_key=object_key,
    )
    session.add(media)
    session.commit()
    return PresignResponse(
        upload_url=create_presigned_upload_url(
            object_key=object_key,
            content_type=body.content_type,
        ),
        object_key=object_key,
    )


@router.post("/cleanup-orphans", response_model=Message)
def cleanup_orphans(*, current_user: CurrentUser) -> Message:
    """Admin-only: enqueue an orphan-media cleanup task via arq."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    async def _enqueue() -> None:
        redis = await create_pool(redis_settings_from_url(settings.REDIS_URL))
        try:
            await redis.enqueue_job("cleanup_orphan_media")
        finally:
            await redis.aclose()

    asyncio.run(_enqueue())
    return Message(message="Cleanup task enqueued")
