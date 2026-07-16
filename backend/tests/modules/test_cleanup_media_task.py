import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from app.models import ProblemMedia
from app.worker.tasks import cleanup_media


class DummySession:
    def __init__(self, media_rows: list[ProblemMedia]) -> None:
        self.media_rows = media_rows
        self.deleted: list[ProblemMedia] = []
        self.committed = False

    def __enter__(self) -> "DummySession":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def exec(self, statement: object) -> "DummyResult":
        _ = statement
        rows = [
            media
            for media in self.media_rows
            if media.problem_id is None
            and media.project_update_id is None
            and media.created_at
            < datetime.now(timezone.utc)
            - timedelta(hours=cleanup_media.settings.MEDIA_ORPHAN_TTL_HOURS)
        ]
        return DummyResult(rows)

    def delete(self, obj: ProblemMedia) -> None:
        self.deleted.append(obj)

    def commit(self) -> None:
        self.committed = True


class DummyResult:
    def __init__(self, media_rows: list[ProblemMedia]) -> None:
        self.media_rows = media_rows

    def all(self) -> list[ProblemMedia]:
        return self.media_rows


def _media(
    *,
    object_key: str,
    age_hours: int,
    problem_id: uuid.UUID | None = None,
    project_update_id: uuid.UUID | None = None,
) -> ProblemMedia:
    return ProblemMedia(
        uploaded_by=uuid.uuid4(),
        kind="photo",
        object_key=object_key,
        problem_id=problem_id,
        project_update_id=project_update_id,
        created_at=datetime.now(timezone.utc) - timedelta(hours=age_hours),
    )


def test_cleanup_orphan_media_deletes_only_old_unlinked_media(monkeypatch) -> None:
    old_orphan = _media(object_key="photo/old.jpg", age_hours=48)
    linked_problem = _media(
        object_key="photo/problem.jpg",
        age_hours=48,
        problem_id=uuid.uuid4(),
    )
    linked_update = _media(
        object_key="photo/update.jpg",
        age_hours=48,
        project_update_id=uuid.uuid4(),
    )
    recent_orphan = _media(object_key="photo/recent.jpg", age_hours=1)
    session = DummySession([old_orphan, linked_problem, linked_update, recent_orphan])
    deleted_keys = []

    monkeypatch.setattr(cleanup_media, "Session", lambda engine: session)
    monkeypatch.setattr(
        cleanup_media,
        "delete_media_object",
        lambda object_key: deleted_keys.append(object_key),
    )

    result = asyncio.run(cleanup_media.cleanup_orphan_media({}, limit=100))

    assert result == {"deleted": 1, "failed": 0}
    assert deleted_keys == ["photo/old.jpg"]
    assert session.deleted == [old_orphan]
    assert session.committed is True


def test_cleanup_orphan_media_keeps_db_row_when_object_delete_fails(monkeypatch) -> None:
    old_orphan = _media(object_key="photo/old.jpg", age_hours=48)
    session = DummySession([old_orphan])

    def fail_delete(*, object_key: str) -> None:
        _ = object_key
        raise RuntimeError("s3 down")

    monkeypatch.setattr(cleanup_media, "Session", lambda engine: session)
    monkeypatch.setattr(cleanup_media, "delete_media_object", fail_delete)

    result = asyncio.run(cleanup_media.cleanup_orphan_media({}, limit=100))

    assert result == {"deleted": 0, "failed": 1}
    assert session.deleted == []
    assert session.committed is True
