import logging
import uuid

from sqlmodel import Session

from app.core.db import engine
from app.models import AIAnalysis, Problem
from app.modules.ai.analyzer import analyze_problem_with_ai
from app.modules.problems.lifecycle import transition_problem

logger = logging.getLogger(__name__)


async def analyze_problem(ctx: dict, problem_id: str) -> None:
    _ = ctx
    parsed_problem_id = uuid.UUID(problem_id)
    with Session(engine) as session:
        problem = session.get(Problem, parsed_problem_id)
        if not problem or problem.status != "ai_processing":
            return

        try:
            await analyze_problem_with_ai(session=session, problem=problem)
        except Exception as exc:
            logger.exception("analyze_problem failed for problem_id=%s", problem_id)
            session.add(
                AIAnalysis(
                    problem_id=problem.id,
                    model="worker_error",
                    summary_json={
                        "error": exc.__class__.__name__,
                        "message": str(exc),
                    },
                )
            )
            transition_problem(
                session=session,
                problem=problem,
                to_status="needs_review",
                reason="ai_worker_error",
            )
        session.commit()
