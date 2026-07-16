import re
from difflib import SequenceMatcher

from sqlmodel import Session, select

from app.models import Problem

DEDUP_TEXT_THRESHOLD = 0.88
DEDUP_CANDIDATE_LIMIT = 100


def normalize_problem_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.casefold()
    normalized = re.sub(r"[^\w\s]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def similarity_score(left: str, right: str) -> float:
    if not left or not right:
        return 0
    return SequenceMatcher(None, left, right).ratio()


def find_duplicate_problem(
    *,
    session: Session,
    problem_in_text: str | None,
    threshold: float = DEDUP_TEXT_THRESHOLD,
) -> Problem | None:
    normalized_text = normalize_problem_text(problem_in_text)
    if len(normalized_text) < 24:
        return None

    candidates = session.exec(
        select(Problem)
        .where(
            Problem.raw_text.is_not(None),
            Problem.duplicate_of.is_(None),
            Problem.status.in_(["ai_processing", "needs_review", "published", "claimed", "piloting"]),
        )
        .order_by(Problem.created_at.desc())
        .limit(DEDUP_CANDIDATE_LIMIT)
    ).all()
    for candidate in candidates:
        candidate_text = normalize_problem_text(candidate.raw_text)
        if similarity_score(normalized_text, candidate_text) >= threshold:
            return candidate
    return None
