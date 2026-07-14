import uuid

import pytest
from fastapi import HTTPException

from app.models import Problem
from app.modules.problems.lifecycle import ALLOWED_TRANSITIONS, transition_problem


class DummySession:
    def __init__(self) -> None:
        self.objects: list[object] = []

    def add(self, obj: object) -> None:
        self.objects.append(obj)


def test_allowed_transition_matrix_contains_core_flow() -> None:
    assert "ai_processing" in ALLOWED_TRANSITIONS["draft"]
    assert "published" in ALLOWED_TRANSITIONS["ai_processing"]
    assert "claimed" in ALLOWED_TRANSITIONS["published"]
    assert "piloting" in ALLOWED_TRANSITIONS["claimed"]
    assert "solved" in ALLOWED_TRANSITIONS["piloting"]


def test_transition_problem_updates_status_and_adds_log() -> None:
    session = DummySession()
    problem = Problem(id=uuid.uuid4(), author_id=uuid.uuid4(), raw_text="test", status="draft")

    transition_problem(
        session=session,  # type: ignore[arg-type]
        problem=problem,
        to_status="ai_processing",
        reason="submitted",
    )

    assert problem.status == "ai_processing"
    assert len(session.objects) == 2


def test_transition_problem_rejects_invalid_status_change() -> None:
    session = DummySession()
    problem = Problem(id=uuid.uuid4(), author_id=uuid.uuid4(), raw_text="test", status="draft")

    with pytest.raises(HTTPException):
        transition_problem(
            session=session,  # type: ignore[arg-type]
            problem=problem,
            to_status="solved",
        )
