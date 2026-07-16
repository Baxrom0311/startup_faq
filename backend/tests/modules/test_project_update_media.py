import uuid

import pytest
from fastapi import HTTPException

from app.api.routes import projects
from app.models import ProblemMedia, ProjectUpdateLog, User


class DummySession:
    def __init__(self, media_rows: list[ProblemMedia]) -> None:
        self.media_rows = media_rows

    def exec(self, statement: object) -> "DummyResult":
        _ = statement
        return DummyResult(self.media_rows)


class DummyResult:
    def __init__(self, media_rows: list[ProblemMedia]) -> None:
        self.media_rows = media_rows

    def all(self) -> list[ProblemMedia]:
        return self.media_rows


def test_project_update_media_serialization_adds_read_urls(monkeypatch) -> None:
    media = ProblemMedia(
        uploaded_by=uuid.uuid4(),
        kind="photo",
        object_key="photo/demo.jpg",
    )
    update = ProjectUpdateLog(
        project_id=uuid.uuid4(),
        author_id=media.uploaded_by,
        text="Pilot boshlandi",
        media_keys=[media.object_key],
    )
    monkeypatch.setattr(
        projects,
        "create_presigned_read_url",
        lambda object_key: f"https://media.test/{object_key}",
    )

    result = projects._serialize_project_update(  # noqa: SLF001
        session=DummySession([media]),  # type: ignore[arg-type]
        update=update,
    )

    assert result.media_keys == [media.object_key]
    assert len(result.media) == 1
    assert result.media[0].url == "https://media.test/photo/demo.jpg"


def test_project_update_media_ownership_accepts_owned_key() -> None:
    user = User(id=uuid.uuid4(), email="lead@example.com", hashed_password="x")
    media = ProblemMedia(
        uploaded_by=user.id,
        kind="photo",
        object_key="photo/owned.jpg",
    )

    result = projects._get_owned_update_media(  # noqa: SLF001
        session=DummySession([media]),  # type: ignore[arg-type]
        current_user=user,
        media_keys=[media.object_key],
    )

    assert result == [media]


def test_project_update_media_ownership_rejects_unknown_key() -> None:
    user = User(id=uuid.uuid4(), email="lead@example.com", hashed_password="x")

    with pytest.raises(HTTPException):
        projects._get_owned_update_media(  # noqa: SLF001
            session=DummySession([]),  # type: ignore[arg-type]
            current_user=user,
            media_keys=["photo/foreign.jpg"],
        )


def test_project_update_media_ownership_rejects_already_linked_key() -> None:
    user = User(id=uuid.uuid4(), email="lead@example.com", hashed_password="x")
    media = ProblemMedia(
        uploaded_by=user.id,
        kind="photo",
        object_key="photo/linked.jpg",
        project_update_id=uuid.uuid4(),
    )

    with pytest.raises(HTTPException):
        projects._get_owned_update_media(  # noqa: SLF001
            session=DummySession([media]),  # type: ignore[arg-type]
            current_user=user,
            media_keys=[media.object_key],
        )
