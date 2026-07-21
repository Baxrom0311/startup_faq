import logging
import math
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models import (
    AIAnalysis,
    Comment,
    Problem,
    ProblemEmbedding,
    ProblemMedia,
    Vote,
)
from app.modules.ai.providers import (
    LLM_PROMPT_VERSION,
    DeterministicLLMProvider,
    get_embedding_provider,
    get_llm_provider,
    get_stt_provider,
)
from app.modules.ai.schemas import AIResult
from app.modules.problems.lifecycle import transition_problem

EMBEDDING_DUPLICATE_THRESHOLD = 0.9
logger = logging.getLogger(__name__)


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0
    return dot / (left_norm * right_norm)


def calculate_severity_score(
    *,
    vote_count: int,
    confidence: float,
    pain_level: int | None,
    duplicate_signal: bool,
) -> float:
    vote_component = min(vote_count, 50) * 1.5
    pain_component = (pain_level or 2) * 10
    confidence_component = confidence * 20
    duplicate_component = 10 if duplicate_signal else 0
    return round(vote_component + pain_component + confidence_component + duplicate_component, 2)


def find_embedding_duplicate(
    *,
    session: Session,
    problem: Problem,
    embedding: list[float],
    threshold: float = EMBEDDING_DUPLICATE_THRESHOLD,
) -> Problem | None:
    if not embedding:
        return None
    stored_embeddings = session.exec(
        select(ProblemEmbedding).where(ProblemEmbedding.problem_id != problem.id)
    ).all()
    best_problem_id = None
    best_score = 0.0
    for stored in stored_embeddings:
        score = cosine_similarity(embedding, stored.embedding)
        if score > best_score:
            best_problem_id = stored.problem_id
            best_score = score
    if best_problem_id is None or best_score < threshold:
        return None
    candidate = session.get(Problem, best_problem_id)
    if not candidate or candidate.duplicate_of is not None or candidate.status == "archived":
        return None
    return candidate


def merge_duplicate_problem(
    *, session: Session, source: Problem, target: Problem, reason: str
) -> None:
    if not session.get(Vote, (source.author_id, target.id)):
        session.add(Vote(user_id=source.author_id, problem_id=target.id))
        target.vote_count += 1

    comments = session.exec(select(Comment).where(Comment.problem_id == source.id)).all()
    for comment in comments:
        comment.problem_id = target.id
        session.add(comment)

    media_items = session.exec(select(ProblemMedia).where(ProblemMedia.problem_id == source.id)).all()
    for media in media_items:
        media.problem_id = target.id
        session.add(media)

    source.duplicate_of = target.id
    source.updated_at = datetime.now(timezone.utc)
    transition_problem(
        session=session,
        problem=source,
        to_status="archived",
        reason=reason,
    )
    session.add(target)


async def analyze_problem_with_ai(*, session: Session, problem: Problem) -> AIResult:
    has_audio = bool(problem.raw_audio_key)
    transcript = problem.transcript
    if has_audio and not transcript:
        try:
            transcript = await get_stt_provider().transcribe(problem.raw_audio_key or "")
        except Exception:
            logger.exception("STT provider failed; continuing without transcript")
            transcript = ""
        problem.transcript = transcript or None

    source_text = transcript or problem.raw_text or ""
    llm_provider = get_llm_provider()
    try:
        structured = await llm_provider.structure_problem(source_text, has_audio=has_audio)
    except Exception:
        logger.exception("LLM provider failed; falling back to deterministic analyzer")
        llm_provider = DeterministicLLMProvider()
        structured = await llm_provider.structure_problem(source_text, has_audio=has_audio)
    embedding_provider = get_embedding_provider()
    embedding_text = " ".join(
        part
        for part in [structured.title, structured.summary, source_text]
        if part
    )
    embedding = await embedding_provider.embed(embedding_text)
    duplicate = find_embedding_duplicate(
        session=session,
        problem=problem,
        embedding=embedding,
    )

    problem.title = structured.title
    problem.structured_desc = structured.model_dump()
    problem.severity_score = calculate_severity_score(
        vote_count=problem.vote_count,
        confidence=structured.confidence,
        pain_level=structured.pain_level,
        duplicate_signal=duplicate is not None,
    )

    session.merge(
        ProblemEmbedding(
            problem_id=problem.id,
            model=embedding_provider.name,
            embedding=embedding,
            updated_at=datetime.now(timezone.utc),
        )
    )
    session.add(
        AIAnalysis(
            problem_id=problem.id,
            model=f"{llm_provider.name}+{embedding_provider.name}",
            summary_json={
                "structured": structured.model_dump(),
                "duplicate_of": str(duplicate.id) if duplicate else None,
                "severity_score": problem.severity_score,
                "prompt_version": LLM_PROMPT_VERSION,
            },
        )
    )

    if duplicate:
        merge_duplicate_problem(
            session=session,
            source=problem,
            target=duplicate,
            reason="ai_duplicate",
        )
    elif problem.status == "ai_processing":
        # Only change status when processing from scratch; reanalysis of
        # published/claimed/piloting problems keeps their current status.
        needs_review = (
            not structured.is_actionable
            or structured.flags.get("needs_review", False)
            or structured.flags.get("spam", False)
            or structured.flags.get("toxic", False)
            or structured.flags.get("unsafe", False)
            or structured.flags.get("not_a_problem", False)
        )
        next_status = "needs_review" if needs_review else "published"
        transition_problem(
            session=session,
            problem=problem,
            to_status=next_status,
            reason="ai_analyzer",
        )

    return AIResult(
        transcript=transcript,
        structured=structured,
        embedding=embedding,
        severity_score=problem.severity_score or 0,
        model=f"{llm_provider.name}+{embedding_provider.name}",
    )
