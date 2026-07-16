import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session

from app.models import Problem, ProblemStatusLog

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"ai_processing", "archived"},
    "ai_processing": {"published", "needs_review", "archived"},
    "needs_review": {"ai_processing", "published", "archived"},
    "published": {"ai_processing", "claimed", "archived"},
    "claimed": {"piloting", "published", "archived"},
    "piloting": {"solved", "archived"},
    "solved": {"archived"},
    "archived": set(),
}


def transition_problem(
    *,
    session: Session,
    problem: Problem,
    to_status: str,
    actor_id: uuid.UUID | None = None,
    reason: str | None = None,
) -> Problem:
    from_status = problem.status
    if from_status == to_status:
        return problem
    if to_status not in ALLOWED_TRANSITIONS.get(from_status, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid problem status transition: {from_status} -> {to_status}",
        )

    problem.status = to_status
    now = datetime.now(timezone.utc)
    problem.updated_at = now
    if to_status == "published" and problem.published_at is None:
        problem.published_at = now

    session.add(problem)
    session.add(
        ProblemStatusLog(
            problem_id=problem.id,
            from_status=from_status,
            to_status=to_status,
            actor_id=actor_id,
            reason=reason,
        )
    )
    return problem
