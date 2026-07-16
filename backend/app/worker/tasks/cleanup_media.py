import logging
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.models import ProblemMedia
from app.modules.media.service import delete_media_object

logger = logging.getLogger(__name__)


def find_orphan_media(
    *, session: Session, older_than: datetime, limit: int
) -> list[ProblemMedia]:
    return session.exec(
        select(ProblemMedia)
        .where(
            ProblemMedia.problem_id.is_(None),
            ProblemMedia.project_update_id.is_(None),
            ProblemMedia.created_at < older_than,
        )
        .order_by(ProblemMedia.created_at.asc())
        .limit(limit)
    ).all()


async def cleanup_orphan_media(ctx: dict, limit: int = 100) -> dict[str, int]:
    _ = ctx
    cutoff = datetime.now(timezone.utc) - timedelta(
        hours=settings.MEDIA_ORPHAN_TTL_HOURS
    )
    deleted = 0
    failed = 0
    with Session(engine) as session:
        media_items = find_orphan_media(
            session=session,
            older_than=cutoff,
            limit=limit,
        )
        for media in media_items:
            try:
                delete_media_object(object_key=media.object_key)
            except Exception:
                failed += 1
                logger.exception("Failed to delete orphan media object: %s", media.object_key)
                continue
            session.delete(media)
            deleted += 1
        session.commit()
    return {"deleted": deleted, "failed": failed}
