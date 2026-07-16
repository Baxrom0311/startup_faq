import pytest
from pydantic import ValidationError

from app.models import ProblemCreate


def test_problem_create_accepts_text() -> None:
    problem = ProblemCreate(raw_text="Issiqxonada suv nazorati qiyin")
    assert problem.raw_text == "Issiqxonada suv nazorati qiyin"


def test_problem_create_accepts_photo() -> None:
    problem = ProblemCreate(photo_keys=["photo/one.png"])
    assert problem.photo_keys == ["photo/one.png"]


def test_problem_create_requires_text_audio_or_photo() -> None:
    with pytest.raises(ValidationError):
        ProblemCreate()
