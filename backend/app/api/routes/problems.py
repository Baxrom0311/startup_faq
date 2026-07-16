import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    AIAnalysis,
    Comment,
    CommentCreate,
    CommentsPublic,
    Message,
    Problem,
    ProblemCreate,
    ProblemMedia,
    ProblemMergeRequest,
    ProblemPublic,
    ProblemsPublic,
    Project,
    Sector,
    Vote,
)
from app.modules.ai.moderation import moderate_content
from app.modules.ai.queue import enqueue_analyze_problem_best_effort
from app.modules.ai.schemas import AIAnalysisPublic, AIAnalysisPublics
from app.modules.media.schemas import ProblemMediaPublic, ProblemMediaPublics
from app.modules.media.service import create_presigned_read_url
from app.modules.notifications.queue import enqueue_notification_delivery_best_effort
from app.modules.notifications.service import create_notification
from app.modules.problems.dedup import find_duplicate_problem, normalize_problem_text
from app.modules.problems.lifecycle import transition_problem

router = APIRouter(prefix="/problems", tags=["problems"])

# Statuses visible to any logged-in user (not just the author)
_PUBLIC_STATUSES: frozenset[str] = frozenset(
    {"published", "archived", "solved", "claimed", "piloting"}
)


def _ensure_admin(current_user: CurrentUser) -> None:
    if current_user.is_superuser:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


def _get_problem_or_404(*, session: SessionDep, problem_id: uuid.UUID) -> Problem:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    return problem


def _has_voted(*, session: SessionDep, user_id: uuid.UUID, problem_id: uuid.UUID) -> bool:
    return session.get(Vote, (user_id, problem_id)) is not None


def _problem_public(
    *, session: SessionDep, current_user: CurrentUser, problem: Problem
) -> ProblemPublic:
    public = ProblemPublic.model_validate(problem)
    public.has_voted = _has_voted(
        session=session,
        user_id=current_user.id,
        problem_id=problem.id,
    )
    public.comment_count = session.exec(
        select(func.count()).select_from(Comment).where(Comment.problem_id == problem.id)
    ).one()
    public.project_count = session.exec(
        select(func.count()).select_from(Project).where(Project.problem_id == problem.id)
    ).one()
    return public


def _add_vote_if_needed(
    *, session: SessionDep, current_user: CurrentUser, problem: Problem
) -> None:
    if _has_voted(session=session, user_id=current_user.id, problem_id=problem.id):
        return
    session.add(Vote(user_id=current_user.id, problem_id=problem.id))
    problem.vote_count += 1
    session.add(problem)


def _attach_owned_media(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_id: uuid.UUID,
    media_keys: list[str],
) -> None:
    for media_key in media_keys:
        media = session.exec(
            select(ProblemMedia).where(
                ProblemMedia.object_key == media_key,
                ProblemMedia.uploaded_by == current_user.id,
                ProblemMedia.problem_id.is_(None),
            )
        ).first()
        if not media:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Media key is not available for this user",
            )
        media.problem_id = problem_id
        session.add(media)


@router.post("/", response_model=ProblemPublic, status_code=201)
async def create_problem(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_in: ProblemCreate,
) -> Any:
    # Validate sector if provided
    sector: Sector | None = None
    if problem_in.sector_id is not None:
        sector = session.get(Sector, problem_in.sector_id)
        if not sector:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Sektor topilmadi.",
            )

    media_keys = [key for key in [problem_in.raw_audio_key, *problem_in.photo_keys] if key]
    duplicate = find_duplicate_problem(
        session=session,
        problem_in_text=problem_in.raw_text,
    )
    if duplicate:
        _add_vote_if_needed(session=session, current_user=current_user, problem=duplicate)
        if media_keys:
            _attach_owned_media(
                session=session,
                current_user=current_user,
                problem_id=duplicate.id,
                media_keys=media_keys,
            )
        if (
            problem_in.raw_text
            and normalize_problem_text(problem_in.raw_text)
            != normalize_problem_text(duplicate.raw_text)
        ):
            session.add(
                Comment(
                    problem_id=duplicate.id,
                    user_id=current_user.id,
                    text=problem_in.raw_text,
                )
            )
        session.commit()
        session.refresh(duplicate)
        result = _problem_public(session=session, current_user=current_user, problem=duplicate)
        result.is_duplicate = True
        return result

    # AI content moderation (synchronous — user gets instant feedback)
    if problem_in.raw_text:
        sector_name = sector.name_uz if sector else "Umumiy"
        moderation = await moderate_content(text=problem_in.raw_text, sector_name=sector_name)
        if not moderation.approved:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=moderation.reason or "Muammo matni qabul qilinmadi.",
            )

    problem_data = problem_in.model_dump(exclude={"photo_keys"})
    problem = Problem.model_validate(
        problem_data,
        update={
            "author_id": current_user.id,
            "status": "draft",
        },
    )
    session.add(problem)
    session.flush()
    transition_problem(
        session=session,
        problem=problem,
        to_status="published",
        actor_id=current_user.id,
        reason="ai_approved",
    )
    _attach_owned_media(
        session=session,
        current_user=current_user,
        problem_id=problem.id,
        media_keys=media_keys,
    )
    session.commit()
    session.refresh(problem)
    return _problem_public(session=session, current_user=current_user, problem=problem)


@router.get("/{problem_id}/media", response_model=ProblemMediaPublics)
def read_problem_media(
    session: SessionDep, current_user: CurrentUser, problem_id: uuid.UUID
) -> Any:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    media_items = session.exec(
        select(ProblemMedia)
        .where(ProblemMedia.problem_id == problem_id)
        .order_by(ProblemMedia.created_at.asc())
    ).all()
    data = [
        ProblemMediaPublic(
            id=media.id,
            problem_id=media.problem_id,
            kind=media.kind,
            object_key=media.object_key,
            url=create_presigned_read_url(object_key=media.object_key),
            created_at=media.created_at,
        )
        for media in media_items
    ]
    return ProblemMediaPublics(data=data, count=len(data))


@router.get("/{problem_id}/analyses", response_model=AIAnalysisPublics)
def read_problem_analyses(
    *, session: SessionDep, current_user: CurrentUser, problem_id: uuid.UUID
) -> Any:
    _ensure_admin(current_user)
    problem = _get_problem_or_404(session=session, problem_id=problem_id)
    analyses = session.exec(
        select(AIAnalysis)
        .where(AIAnalysis.problem_id == problem.id)
        .order_by(AIAnalysis.created_at.desc())
    ).all()
    return AIAnalysisPublics(
        data=[AIAnalysisPublic.model_validate(analysis) for analysis in analyses],
        count=len(analyses),
    )


@router.get("/", response_model=ProblemsPublic)
def read_problems(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 20,
    status: str = "published",
    sector_id: int | None = None,
    region_id: int | None = None,
    mine: bool = False,
    q: str | None = None,
) -> Any:
    if status not in _PUBLIC_STATUSES and not current_user.is_superuser and not mine:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions to filter by this status",
        )
    filters = [Problem.status == status]
    if sector_id is not None:
        filters.append(Problem.sector_id == sector_id)
    if region_id is not None:
        filters.append(Problem.region_id == region_id)
    if mine:
        filters.append(Problem.author_id == current_user.id)
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            (Problem.title.ilike(pattern))
            | (Problem.raw_text.ilike(pattern))
            | (Problem.transcript.ilike(pattern))
        )

    count_statement = select(func.count()).select_from(Problem).where(*filters)
    count = session.exec(count_statement).one()
    statement = (
        select(Problem)
        .where(*filters)
        .order_by(Problem.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    problems = session.exec(statement).all()
    problem_ids = [problem.id for problem in problems]
    voted_problem_ids = set()
    comment_counts = {}
    project_counts = {}
    if problem_ids:
        voted_problem_ids = set(
            session.exec(
                select(Vote.problem_id).where(
                    Vote.user_id == current_user.id,
                    Vote.problem_id.in_(problem_ids),
                )
            ).all()
        )
        comment_counts = dict(
            session.exec(
                select(Comment.problem_id, func.count())
                .where(Comment.problem_id.in_(problem_ids))
                .group_by(Comment.problem_id)
            ).all()
        )
        project_counts = dict(
            session.exec(
                select(Project.problem_id, func.count())
                .where(Project.problem_id.in_(problem_ids))
                .group_by(Project.problem_id)
            ).all()
        )
    data = []
    for problem in problems:
        public = ProblemPublic.model_validate(problem)
        public.has_voted = problem.id in voted_problem_ids
        public.comment_count = comment_counts.get(problem.id, 0)
        public.project_count = project_counts.get(problem.id, 0)
        data.append(public)
    return ProblemsPublic(data=data, count=count)


@router.get("/{problem_id}", response_model=ProblemPublic)
def read_problem(
    *, session: SessionDep, current_user: CurrentUser, problem_id: uuid.UUID
) -> Any:
    problem = _get_problem_or_404(session=session, problem_id=problem_id)
    if (
        problem.status not in _PUBLIC_STATUSES
        and not current_user.is_superuser
        and problem.author_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    return _problem_public(session=session, current_user=current_user, problem=problem)


@router.post("/{problem_id}/publish", response_model=ProblemPublic)
def publish_problem(
    *, session: SessionDep, current_user: CurrentUser, problem_id: uuid.UUID
) -> Any:
    _ensure_admin(current_user)
    problem = _get_problem_or_404(session=session, problem_id=problem_id)
    author_id = problem.author_id
    transition_problem(
        session=session,
        problem=problem,
        to_status="published",
        actor_id=current_user.id,
        reason="manual_publish",
    )
    notification = None
    if author_id != current_user.id:
        notification = create_notification(
            session=session,
            user_id=author_id,
            type="problem.published",
            payload={"problem_id": str(problem.id), "title": problem.title or problem.raw_text or ""},
        )
    session.commit()
    if notification:
        enqueue_notification_delivery_best_effort(notification.id)
    session.refresh(problem)
    return _problem_public(session=session, current_user=current_user, problem=problem)


@router.post("/{problem_id}/archive", response_model=ProblemPublic)
def archive_problem(
    *, session: SessionDep, current_user: CurrentUser, problem_id: uuid.UUID
) -> Any:
    _ensure_admin(current_user)
    problem = _get_problem_or_404(session=session, problem_id=problem_id)
    author_id = problem.author_id
    transition_problem(
        session=session,
        problem=problem,
        to_status="archived",
        actor_id=current_user.id,
        reason="manual_archive",
    )
    notification = None
    if author_id != current_user.id:
        notification = create_notification(
            session=session,
            user_id=author_id,
            type="problem.archived",
            payload={"problem_id": str(problem.id), "title": problem.title or problem.raw_text or ""},
        )
    session.commit()
    if notification:
        enqueue_notification_delivery_best_effort(notification.id)
    session.refresh(problem)
    return _problem_public(session=session, current_user=current_user, problem=problem)


@router.post("/{problem_id}/reanalyze", response_model=ProblemPublic)
def reanalyze_problem(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_id: uuid.UUID,
    background_tasks: BackgroundTasks,
) -> Any:
    _ensure_admin(current_user)
    problem = _get_problem_or_404(session=session, problem_id=problem_id)
    if problem.status in {"archived", "solved"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived or solved problems cannot be reanalyzed",
        )
    transition_problem(
        session=session,
        problem=problem,
        to_status="ai_processing",
        actor_id=current_user.id,
        reason="manual_reanalyze",
    )
    session.commit()
    session.refresh(problem)
    background_tasks.add_task(enqueue_analyze_problem_best_effort, problem.id)
    return _problem_public(session=session, current_user=current_user, problem=problem)


@router.post("/{problem_id}/solve", response_model=ProblemPublic)
def solve_problem(
    *, session: SessionDep, current_user: CurrentUser, problem_id: uuid.UUID
) -> Any:
    problem = _get_problem_or_404(session=session, problem_id=problem_id)
    if not current_user.is_superuser and problem.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    transition_problem(
        session=session,
        problem=problem,
        to_status="solved",
        actor_id=current_user.id,
        reason="manual_solve",
    )
    session.commit()
    session.refresh(problem)
    return _problem_public(session=session, current_user=current_user, problem=problem)


@router.post("/{problem_id}/merge", response_model=ProblemPublic)
def merge_problem(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_id: uuid.UUID,
    merge_in: ProblemMergeRequest,
) -> Any:
    _ensure_admin(current_user)
    source = _get_problem_or_404(session=session, problem_id=problem_id)
    target = _get_problem_or_404(session=session, problem_id=merge_in.target_problem_id)
    if source.id == target.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Problem cannot be merged into itself",
        )

    source_voters = session.exec(select(Vote).where(Vote.problem_id == source.id)).all()
    for vote in source_voters:
        if not session.get(Vote, (vote.user_id, target.id)):
            session.add(Vote(user_id=vote.user_id, problem_id=target.id))
            target.vote_count += 1
        session.delete(vote)

    comments = session.exec(select(Comment).where(Comment.problem_id == source.id)).all()
    for comment in comments:
        comment.problem_id = target.id
        session.add(comment)

    media_items = session.exec(select(ProblemMedia).where(ProblemMedia.problem_id == source.id)).all()
    for media in media_items:
        media.problem_id = target.id
        session.add(media)

    source.duplicate_of = target.id
    source_author_id = source.author_id
    transition_problem(
        session=session,
        problem=source,
        to_status="archived",
        actor_id=current_user.id,
        reason="merged",
    )
    notification = None
    if source_author_id != current_user.id:
        notification = create_notification(
            session=session,
            user_id=source_author_id,
            type="problem.merged",
            payload={
                "problem_id": str(source.id),
                "target_problem_id": str(target.id),
                "title": source.title or source.raw_text or "",
            },
        )
    session.add(target)
    session.commit()
    if notification:
        enqueue_notification_delivery_best_effort(notification.id)
    session.refresh(target)
    return _problem_public(session=session, current_user=current_user, problem=target)


@router.put("/{problem_id}/vote", status_code=204)
def vote_problem(
    *, session: SessionDep, current_user: CurrentUser, problem_id: uuid.UUID
) -> None:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    vote = session.get(Vote, (current_user.id, problem_id))
    if vote:
        return None

    session.add(Vote(user_id=current_user.id, problem_id=problem_id))
    problem.vote_count += 1
    session.add(problem)
    session.commit()
    return None


@router.delete("/{problem_id}/vote")
def unvote_problem(
    *, session: SessionDep, current_user: CurrentUser, problem_id: uuid.UUID
) -> Message:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    vote = session.get(Vote, (current_user.id, problem_id))
    if vote:
        session.delete(vote)
        problem.vote_count = max(problem.vote_count - 1, 0)
        session.add(problem)
        session.commit()
    return Message(message="Vote removed")


@router.get("/{problem_id}/comments", response_model=CommentsPublic)
def read_comments(
    session: SessionDep, problem_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> Any:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    count_statement = (
        select(func.count()).select_from(Comment).where(Comment.problem_id == problem_id)
    )
    count = session.exec(count_statement).one()
    statement = (
        select(Comment)
        .where(Comment.problem_id == problem_id)
        .order_by(Comment.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    comments = session.exec(statement).all()
    return CommentsPublic(data=comments, count=count)


@router.post("/{problem_id}/comments", response_model=Comment, status_code=201)
def create_comment(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_id: uuid.UUID,
    comment_in: CommentCreate,
) -> Any:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    comment = Comment.model_validate(
        comment_in,
        update={"problem_id": problem_id, "user_id": current_user.id},
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment
