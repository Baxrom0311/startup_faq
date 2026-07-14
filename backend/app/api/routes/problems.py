import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Comment,
    CommentCreate,
    CommentsPublic,
    Message,
    Problem,
    ProblemCreate,
    ProblemMedia,
    ProblemPublic,
    ProblemsPublic,
    Vote,
)
from app.modules.ai.queue import enqueue_analyze_problem_best_effort
from app.modules.problems.lifecycle import transition_problem

router = APIRouter(prefix="/problems", tags=["problems"])


@router.post("/", response_model=ProblemPublic, status_code=202)
def create_problem(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_in: ProblemCreate,
    background_tasks: BackgroundTasks,
) -> Any:
    problem = Problem.model_validate(
        problem_in,
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
        to_status="ai_processing",
        actor_id=current_user.id,
        reason="problem_submitted",
    )
    if problem.raw_audio_key:
        media = session.exec(
            select(ProblemMedia).where(ProblemMedia.object_key == problem.raw_audio_key)
        ).first()
        if media:
            media.problem_id = problem.id
            session.add(media)
    session.commit()
    session.refresh(problem)
    background_tasks.add_task(enqueue_analyze_problem_best_effort, problem.id)
    return problem


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
) -> Any:
    filters = [Problem.status == status]
    if sector_id is not None:
        filters.append(Problem.sector_id == sector_id)
    if region_id is not None:
        filters.append(Problem.region_id == region_id)
    if mine:
        filters.append(Problem.author_id == current_user.id)

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
    return ProblemsPublic(data=problems, count=count)


@router.get("/{problem_id}", response_model=ProblemPublic)
def read_problem(session: SessionDep, problem_id: uuid.UUID) -> Any:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem


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
