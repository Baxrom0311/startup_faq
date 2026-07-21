from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, func, select

from app.models import (
    Notification,
    Problem,
    Project,
    ProjectCreate,
    ProjectMember,
    Review,
    ReviewCreate,
    User,
)
from app.modules.notifications.service import create_notification
from app.modules.problems.lifecycle import transition_problem

MAX_PROPOSED_PROJECTS_PER_PROBLEM = 3
MANAGEABLE_PROJECT_STATUSES = {"approved", "in_progress", "piloting"}


def claim_problem(
    *,
    session: Session,
    problem: Problem,
    lead: User,
    project_in: ProjectCreate,
) -> tuple[Project, Notification]:
    if problem.status != "published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only published problems can be claimed",
        )

    existing_count = session.exec(
        select(func.count())
        .select_from(Project)
        .where(Project.problem_id == problem.id, Project.status == "proposed")
    ).one()
    if existing_count >= MAX_PROPOSED_PROJECTS_PER_PROBLEM:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This problem already has the maximum number of proposed projects",
        )

    already_claimed = session.exec(
        select(Project).where(
            Project.problem_id == problem.id,
            Project.lead_id == lead.id,
            Project.status.in_(["proposed", "approved", "in_progress", "piloting"]),
        )
    ).first()
    if already_claimed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active project for this problem",
        )

    project = Project.model_validate(
        project_in,
        update={"problem_id": problem.id, "lead_id": lead.id, "status": "proposed"},
    )
    session.add(project)
    session.flush()
    session.add(ProjectMember(project_id=project.id, user_id=lead.id, role="lead"))
    notification = create_notification(
        session=session,
        user_id=problem.author_id,
        type="project.proposed",
        payload={
            "problem_id": str(problem.id),
            "project_id": str(project.id),
            "project_title": project.title,
            "lead_id": str(lead.id),
        },
    )
    return project, notification


def approve_project(*, session: Session, project: Project, actor: User) -> tuple[Project, Notification]:
    problem = session.get(Problem, project.problem_id)
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    if not actor.is_superuser and problem.author_id != actor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    if project.status != "proposed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only proposed projects can be approved")
    if problem.status != "published":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Problem is not open for approval")

    project.status = "approved"
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    transition_problem(
        session=session,
        problem=problem,
        to_status="claimed",
        actor_id=actor.id,
        reason="project_approved",
    )
    notification = create_notification(
        session=session,
        user_id=project.lead_id,
        type="project.approved",
        payload={
            "problem_id": str(problem.id),
            "project_id": str(project.id),
            "project_title": project.title,
        },
    )
    return project, notification


def reject_project(*, session: Session, project: Project, actor: User) -> tuple[Project, Notification]:
    problem = session.get(Problem, project.problem_id)
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    if not actor.is_superuser and problem.author_id != actor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    if project.status != "proposed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only proposed projects can be rejected")
    project.status = "rejected"
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    notification = create_notification(
        session=session,
        user_id=project.lead_id,
        type="project.rejected",
        payload={
            "problem_id": str(problem.id),
            "project_id": str(project.id),
            "project_title": project.title,
        },
    )
    return project, notification


def ensure_project_manager(*, project: Project, actor: User) -> None:
    if actor.is_superuser or project.lead_id == actor.id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


def ensure_project_manageable(*, project: Project) -> None:
    if project.status in MANAGEABLE_PROJECT_STATUSES:
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Project is not active",
    )


def mark_project_in_progress(*, session: Session, project: Project) -> Project:
    if project.status != "approved":
        return project
    project.status = "in_progress"
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    return project


def start_piloting(*, session: Session, project: Project, actor: User) -> tuple[Project, Notification]:
    ensure_project_manager(project=project, actor=actor)
    if project.status not in {"approved", "in_progress"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project is not ready for piloting")
    problem = session.get(Problem, project.problem_id)
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    project.status = "piloting"
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    transition_problem(
        session=session,
        problem=problem,
        to_status="piloting",
        actor_id=actor.id,
        reason="project_piloting_started",
    )
    notification = create_notification(
        session=session,
        user_id=problem.author_id,
        type="project.piloting_started",
        payload={
            "problem_id": str(problem.id),
            "project_id": str(project.id),
            "project_title": project.title,
        },
    )
    return project, notification


def complete_project_with_review(
    *,
    session: Session,
    project: Project,
    actor: User,
    review_in: ReviewCreate,
) -> tuple[Project, Review, Notification]:
    problem = session.get(Problem, project.problem_id)
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    if not actor.is_superuser and problem.author_id != actor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    if project.status != "piloting":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only piloting projects can be completed")

    project.status = "completed"
    project.updated_at = datetime.now(timezone.utc)
    review = Review.model_validate(
        review_in,
        update={"project_id": project.id, "reviewer_id": actor.id},
    )
    session.add(project)
    session.add(review)
    
    lead = session.get(User, project.lead_id)
    if lead:
        lead.reputation = max(lead.reputation + 20, 0)
        session.add(lead)
    transition_problem(
        session=session,
        problem=problem,
        to_status="solved",
        actor_id=actor.id,
        reason="project_completed_with_review",
    )
    notification = create_notification(
        session=session,
        user_id=project.lead_id,
        type="project.completed",
        payload={
            "problem_id": str(problem.id),
            "project_id": str(project.id),
            "project_title": project.title,
            "rating": review.rating,
        },
    )
    return project, review, notification
