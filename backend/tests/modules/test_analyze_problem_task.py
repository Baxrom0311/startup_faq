import asyncio
import uuid

import pytest

from app.models import AIAnalysis, Problem, ProblemStatusLog
from app.worker.tasks import analyze_problem as task_module


class DummySession:
    def __init__(self, problem: Problem | None) -> None:
        self.problem = problem
        self.objects: list[object] = []
        self.committed = False

    def __enter__(self) -> "DummySession":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def get(self, model: object, object_id: object) -> Problem | None:
        _ = (model, object_id)
        return self.problem

    def add(self, obj: object) -> None:
        self.objects.append(obj)

    def commit(self) -> None:
        self.committed = True


def _patch_session(monkeypatch: pytest.MonkeyPatch, session: DummySession) -> None:
    monkeypatch.setattr(task_module, "Session", lambda engine: session)


def test_analyze_problem_task_runs_analyzer(monkeypatch: pytest.MonkeyPatch) -> None:
    problem = Problem(
        id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        raw_text="Suv bosimi past",
        status="ai_processing",
    )
    session = DummySession(problem)
    calls = []

    async def fake_analyzer(*, session, problem):  # noqa: ANN001, ANN202
        calls.append((session, problem))
        problem.status = "published"

    _patch_session(monkeypatch, session)
    monkeypatch.setattr(task_module, "analyze_problem_with_ai", fake_analyzer)

    asyncio.run(task_module.analyze_problem({}, str(problem.id)))

    assert calls == [(session, problem)]
    assert session.committed is True
    assert problem.status == "published"


def test_analyze_problem_task_moves_failures_to_review(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    problem = Problem(
        id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        raw_text="Suv bosimi past",
        status="ai_processing",
    )
    session = DummySession(problem)

    async def failing_analyzer(*, session, problem):  # noqa: ANN001, ANN202
        _ = (session, problem)
        raise RuntimeError("provider down")

    _patch_session(monkeypatch, session)
    monkeypatch.setattr(task_module, "analyze_problem_with_ai", failing_analyzer)

    asyncio.run(task_module.analyze_problem({}, str(problem.id)))

    assert session.committed is True
    assert problem.status == "needs_review"
    assert any(isinstance(obj, AIAnalysis) for obj in session.objects)
    assert any(isinstance(obj, ProblemStatusLog) for obj in session.objects)


def test_analyze_problem_task_ignores_non_processing_problem(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    problem = Problem(
        id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        raw_text="Suv bosimi past",
        status="published",
    )
    session = DummySession(problem)
    _patch_session(monkeypatch, session)

    asyncio.run(task_module.analyze_problem({}, str(problem.id)))

    assert session.committed is False
