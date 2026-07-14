import uuid
from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.models import ProblemMedia
from app.modules.media.schemas import PresignRequest, PresignResponse
from app.modules.media.service import (
    build_object_key,
    create_presigned_upload_url,
    validate_media,
)

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/presign", response_model=PresignResponse)
def presign_media_upload(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    body: PresignRequest,
) -> Any:
    _ = current_user
    validate_media(kind=body.kind, content_type=body.content_type, size=body.size)
    object_key = build_object_key(kind=body.kind, content_type=body.content_type)
    problem_id = uuid.UUID(body.problem_id) if body.problem_id else None
    media = ProblemMedia(
        problem_id=problem_id,
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
