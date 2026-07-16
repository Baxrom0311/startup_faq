import uuid

import pytest
from fastapi import HTTPException

from app.models import Problem, Project, ProjectCreate, User
from app.modules.projects.service import (
    claim_problem,
    ensure_project_manageable,
    mark_project_in_progress,
    start_piloting,
)


class DummySession:
    def __init__(self, problem: Problem | None = None) -> None:
        self.problem = problem
        self.objects: list[object] = []

    def add(self, obj: object) -> None:
        self.objects.append(obj)

    def flush(self) -> None:
        pass

    def get(self, model: object, object_id: object) -> Problem | None:
        _ = (model, object_id)
        return self.problem

    def exec(self, statement: object) -> "DummyResult":
        _ = statement
        return DummyResult()


class DummyResult:
    def one(self) -> int:
        return 0

    def first(self) -> None:
        return None


def test_claim_problem_requires_published_problem() -> None:
    problem = Problem(
        id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        raw_text="test",
        status="ai_processing",
    )
    lead = User(
        id=uuid.uuid4(),
        email="lead@example.com",
        hashed_password="x",
    )

    with pytest.raises(HTTPException):
        claim_problem(
            session=DummySession(),  # type: ignore[arg-type]
            problem=problem,
            lead=lead,
            project_in=ProjectCreate(title="Demo"),
        )


def test_claim_problem_creates_proposed_project() -> None:
    problem = Problem(
        id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        raw_text="test",
        status="published",
    )
    lead = User(
        id=uuid.uuid4(),
        email="lead@example.com",
        hashed_password="x",
    )

    project, notification = claim_problem(
        session=DummySession(),  # type: ignore[arg-type]
        problem=problem,
        lead=lead,
        project_in=ProjectCreate(title="Demo", pitch="Pilot qilamiz"),
    )

    assert project.problem_id == problem.id
    assert project.lead_id == lead.id
    assert project.status == "proposed"
    assert notification.type == "project.proposed"
    assert notification.user_id == problem.author_id


def test_start_piloting_moves_project_and_problem() -> None:
    problem = Problem(
        id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        raw_text="test",
        status="claimed",
    )
    lead = User(
        id=uuid.uuid4(),
        email="lead@example.com",
        hashed_password="x",
    )
    project = Project(
        id=uuid.uuid4(),
        problem_id=problem.id,
        lead_id=lead.id,
        title="Demo",
        status="approved",
    )

    result_project, notification = start_piloting(
        session=DummySession(problem),  # type: ignore[arg-type]
        project=project,
        actor=lead,
    )

    assert result_project.status == "piloting"
    assert problem.status == "piloting"
    assert notification.type == "project.piloting_started"


@pytest.mark.parametrize("status", ["approved", "in_progress", "piloting"])
def test_ensure_project_manageable_accepts_active_statuses(status: str) -> None:
    project = Project(
        id=uuid.uuid4(),
        problem_id=uuid.uuid4(),
        lead_id=uuid.uuid4(),
        title="Demo",
        status=status,
    )

    ensure_project_manageable(project=project)


@pytest.mark.parametrize("status", ["proposed", "rejected", "completed"])
def test_ensure_project_manageable_rejects_inactive_statuses(status: str) -> None:
    project = Project(
        id=uuid.uuid4(),
        problem_id=uuid.uuid4(),
        lead_id=uuid.uuid4(),
        title="Demo",
        status=status,
    )

    with pytest.raises(HTTPException):
        ensure_project_manageable(project=project)


def test_mark_project_in_progress_moves_approved_project() -> None:
    session = DummySession()
    project = Project(
        id=uuid.uuid4(),
        problem_id=uuid.uuid4(),
        lead_id=uuid.uuid4(),
        title="Demo",
        status="approved",
    )

    mark_project_in_progress(
        session=session,  # type: ignore[arg-type]
        project=project,
    )

    assert project.status == "in_progress"
    assert project in session.objects


def test_mark_project_in_progress_keeps_non_approved_project() -> None:
    session = DummySession()
    project = Project(
        id=uuid.uuid4(),
        problem_id=uuid.uuid4(),
        lead_id=uuid.uuid4(),
        title="Demo",
        status="piloting",
    )

    mark_project_in_progress(
        session=session,  # type: ignore[arg-type]
        project=project,
    )

    assert project.status == "piloting"
    assert project not in session.objects
