import uuid

from sqlmodel import Session

from app.core.db import engine
from app.models import Problem
from app.modules.problems.lifecycle import transition_problem


def _build_title(text: str) -> str:
    compact = " ".join(text.split())
    if len(compact) <= 90:
        return compact
    return f"{compact[:87].rstrip()}..."


def _build_summary(text: str) -> str:
    compact = " ".join(text.split())
    if len(compact) <= 220:
        return compact
    return f"{compact[:217].rstrip()}..."


async def analyze_problem(ctx: dict, problem_id: str) -> None:
    """Dev placeholder for STT -> LLM -> embed -> dedup -> score.

    This keeps the product flow moving before real providers are wired in:
    newly submitted text problems become published with deterministic
    structured metadata.
    """
    _ = ctx
    parsed_problem_id = uuid.UUID(problem_id)
    with Session(engine) as session:
        problem = session.get(Problem, parsed_problem_id)
        if not problem or problem.status != "ai_processing":
            return

        source_text = problem.transcript or problem.raw_text or ""
        has_audio = bool(problem.raw_audio_key)
        problem.title = _build_title(source_text) or ("Audio muammo" if has_audio else "Nomsiz muammo")
        problem.structured_desc = {
            "summary": _build_summary(source_text),
            "who_affected": None,
            "frequency": None,
            "current_workaround": None,
            "pain_level": None,
            "suggested_sector": None,
            "suggested_region": None,
            "tags": [],
            "has_audio": has_audio,
            "is_actionable": bool(source_text or has_audio),
            "confidence": 0.7 if source_text else 0.2,
            "flags": {
                "toxic": False,
                "spam": False,
                "not_a_problem": not bool(source_text),
            },
        }
        problem.severity_score = 0
        transition_problem(
            session=session,
            problem=problem,
            to_status="published" if source_text else "needs_review",
            reason="dev_ai_analyzer",
        )
        session.commit()
