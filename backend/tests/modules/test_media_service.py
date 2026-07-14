import pytest
from fastapi import HTTPException

from app.modules.media.service import build_object_key, validate_media


def test_validate_media_accepts_photo() -> None:
    validate_media(kind="photo", content_type="image/png", size=1024)


def test_validate_media_rejects_large_audio() -> None:
    with pytest.raises(HTTPException):
        validate_media(kind="audio", content_type="audio/ogg", size=20 * 1024 * 1024)


def test_build_object_key_uses_kind_prefix_and_extension() -> None:
    key = build_object_key(kind="audio", content_type="audio/ogg")
    assert key.startswith("audio/")
    assert key.endswith(".ogg")
