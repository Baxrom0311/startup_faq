import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import or_
from sqlmodel import func, select

from app.core.limiter import limiter

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    IssueComment,
    IssueCommentCreate,
    IssueCommentPublic,
    IssueCommentsPublic,
    Problem,
    ProblemMedia,
    Project,
    ProjectCreate,
    ProjectIssue,
    ProjectIssueCreate,
    ProjectIssuePublic,
    ProjectIssuesPublic,
    ProjectIssueUpdate,
    ProjectMilestone,
    ProjectMilestoneCreate,
    ProjectMilestonePublic,
    ProjectMilestonesPublic,
    ProjectMilestoneUpdate,
    ProjectPublic,
    ProjectsPublic,
    ProjectUpdate,
    ProjectUpdateCreate,
    ProjectUpdateLog,
    ProjectUpdateMediaPublic,
    ProjectUpdatePublic,
    ProjectUpdatesPublic,
    Review,
    ReviewCreate,
    ReviewPublic,
    ReviewsPublic,
    User,
    get_datetime_utc,
)
from app.modules.media.service import create_presigned_read_url
from app.modules.notifications.queue import enqueue_notification_delivery_best_effort
from app.modules.projects.service import (
    approve_project,
    claim_problem,
    complete_project_with_review,
    ensure_project_manageable,
    ensure_project_manager,
    mark_project_in_progress,
    reject_project,
    start_piloting,
)

router = APIRouter(tags=["projects"])


def _serialize_project_update(
    *, session: SessionDep, update: ProjectUpdateLog
) -> ProjectUpdatePublic:
    media_rows = []
    if update.media_keys:
        media_rows = session.exec(
            select(ProblemMedia).where(
                or_(
                    ProblemMedia.project_update_id == update.id,
                    ProblemMedia.object_key.in_(update.media_keys),
                )
            )
        ).all()
    media_by_key = {media.object_key: media for media in media_rows}
    media = [
        ProjectUpdateMediaPublic(
            object_key=key,
            kind=media_by_key[key].kind,
            url=create_presigned_read_url(object_key=key),
        )
        for key in update.media_keys
        if key in media_by_key
    ]
    return ProjectUpdatePublic.model_validate(update, update={"media": media})


def _get_owned_update_media(
    *, session: SessionDep, current_user: User, media_keys: list[str]
) -> list[ProblemMedia]:
    keys = list(dict.fromkeys(media_keys))
    if not keys:
        return []
    media_rows = session.exec(
        select(ProblemMedia).where(
            ProblemMedia.object_key.in_(keys),
            ProblemMedia.uploaded_by == current_user.id,
            ProblemMedia.problem_id.is_(None),
            ProblemMedia.project_update_id.is_(None),
        )
    ).all()
    media_rows = [
        media
        for media in media_rows
        if media.uploaded_by == current_user.id
        and media.problem_id is None
        and media.project_update_id is None
    ]
    allowed_keys = {media.object_key for media in media_rows}
    if allowed_keys != set(keys):
        raise HTTPException(
            status_code=403,
            detail="Media does not belong to the current user",
        )
    return media_rows


@router.post("/problems/{problem_id}/claim", response_model=ProjectPublic, status_code=201)
def create_claim(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    problem_id: uuid.UUID,
    project_in: ProjectCreate,
) -> Any:
    problem = session.get(Problem, problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    project, notification = claim_problem(
        session=session,
        problem=problem,
        lead=current_user,
        project_in=project_in,
    )
    session.commit()
    enqueue_notification_delivery_best_effort(notification.id)
    session.refresh(project)
    return project


@router.get("/projects", response_model=ProjectsPublic)
def read_projects(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 20,
    mine: bool = False,
    owner: bool = False,
    status: str | None = None,
    problem_id: uuid.UUID | None = None,
    q: str | None = None,
) -> Any:
    if q and len(q) > 500:
        raise HTTPException(status_code=422, detail="Search query too long (max 500 characters)")
    filters = []
    if mine:
        filters.append(Project.lead_id == current_user.id)
    if status:
        filters.append(Project.status == status)
    if problem_id:
        filters.append(Project.problem_id == problem_id)
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            (Project.title.ilike(pattern))
            | (Project.pitch.ilike(pattern))
        )

    if owner:
        filters.append(Problem.author_id == current_user.id)
        count_statement = (
            select(func.count())
            .select_from(Project)
            .join(Problem, Project.problem_id == Problem.id)
            .where(*filters)
        )
        statement = (
            select(Project)
            .join(Problem, Project.problem_id == Problem.id)
            .where(*filters)
            .order_by(Project.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    else:
        count_statement = select(func.count()).select_from(Project).where(*filters)
        statement = (
            select(Project)
            .where(*filters)
            .order_by(Project.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

    count = session.exec(count_statement).one()
    projects = session.exec(statement).all()
    return ProjectsPublic(data=projects, count=count)


@router.get("/projects/{project_id}", response_model=ProjectPublic)
def read_project(session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/projects/{project_id}", response_model=ProjectPublic)
def update_project_endpoint(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    project_in: ProjectUpdate,
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.lead_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    update_data = project_in.model_dump(exclude_unset=True)
    if not update_data:
        return project
    
    project.sqlmodel_update(update_data)
    project.updated_at = get_datetime_utc()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project



@router.post("/projects/{project_id}/approve", response_model=ProjectPublic)
def approve_project_endpoint(
    *, session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project, notification = approve_project(session=session, project=project, actor=current_user)
    session.commit()
    enqueue_notification_delivery_best_effort(notification.id)
    session.refresh(project)
    return project


@router.post("/projects/{project_id}/reject", response_model=ProjectPublic)
def reject_project_endpoint(
    *, session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project, notification = reject_project(session=session, project=project, actor=current_user)
    session.commit()
    enqueue_notification_delivery_best_effort(notification.id)
    session.refresh(project)
    return project


@router.post("/projects/{project_id}/start-piloting", response_model=ProjectPublic)
def start_project_piloting_endpoint(
    *, session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project, notification = start_piloting(session=session, project=project, actor=current_user)
    session.commit()
    enqueue_notification_delivery_best_effort(notification.id)
    session.refresh(project)
    return project


@router.post("/projects/{project_id}/complete", response_model=ReviewPublic)
@limiter.limit("20/minute")
def complete_project_endpoint(
    *,
    session: SessionDep,
    request: Request,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    review_in: ReviewCreate,
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _, review, notification = complete_project_with_review(
        session=session,
        project=project,
        actor=current_user,
        review_in=review_in,
    )
    session.commit()
    enqueue_notification_delivery_best_effort(notification.id)
    session.refresh(review)
    return review


# ─── Issues ────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/issues", response_model=ProjectIssuesPublic)
def list_issues(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    status: str | None = None,
    kind: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    filters = [ProjectIssue.project_id == project_id]
    if status:
        filters.append(ProjectIssue.status == status)
    if kind:
        filters.append(ProjectIssue.kind == kind)
    count = session.exec(select(func.count()).select_from(ProjectIssue).where(*filters)).one()
    issues = session.exec(
        select(ProjectIssue).where(*filters)
        .order_by(ProjectIssue.created_at.desc())
        .offset(skip).limit(limit)
    ).all()
    return ProjectIssuesPublic(data=issues, count=count)


@router.post("/projects/{project_id}/issues", response_model=ProjectIssuePublic)
def create_issue(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    body: ProjectIssueCreate,
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    issue = ProjectIssue(
        **body.model_dump(),
        project_id=project_id,
        author_id=current_user.id,
    )
    session.add(issue)
    session.commit()
    session.refresh(issue)
    return issue


@router.get("/projects/{project_id}/issues/{issue_id}", response_model=ProjectIssuePublic)
def get_issue(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    issue_id: uuid.UUID,
) -> Any:
    issue = session.exec(
        select(ProjectIssue).where(
            ProjectIssue.id == issue_id,
            ProjectIssue.project_id == project_id,
        )
    ).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.patch("/projects/{project_id}/issues/{issue_id}", response_model=ProjectIssuePublic)
def update_issue(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    issue_id: uuid.UUID,
    body: ProjectIssueUpdate,
) -> Any:
    issue = session.exec(
        select(ProjectIssue).where(
            ProjectIssue.id == issue_id,
            ProjectIssue.project_id == project_id,
        )
    ).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    is_lead = session.exec(select(Project).where(Project.id == project_id)).first()
    if issue.author_id != current_user.id and is_lead.lead_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not allowed")
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] == "closed" and issue.status != "closed":
        from datetime import datetime, timezone
        data["closed_at"] = datetime.now(timezone.utc)
    elif "status" in data and data["status"] == "open":
        data["closed_at"] = None
    for k, v in data.items():
        setattr(issue, k, v)
    issue.updated_at = get_datetime_utc()
    session.add(issue)
    session.commit()
    session.refresh(issue)
    return issue


@router.get("/projects/{project_id}/issues/{issue_id}/comments", response_model=IssueCommentsPublic)
def list_issue_comments(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    issue_id: uuid.UUID,
) -> Any:
    issue = session.exec(select(ProjectIssue).where(ProjectIssue.id == issue_id, ProjectIssue.project_id == project_id)).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    comments = session.exec(
        select(IssueComment).where(IssueComment.issue_id == issue_id)
        .order_by(IssueComment.created_at.asc())
    ).all()
    return IssueCommentsPublic(data=comments, count=len(comments))


@router.post("/projects/{project_id}/issues/{issue_id}/comments", response_model=IssueCommentPublic)
def create_issue_comment(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    issue_id: uuid.UUID,
    body: IssueCommentCreate,
) -> Any:
    issue = session.exec(select(ProjectIssue).where(ProjectIssue.id == issue_id, ProjectIssue.project_id == project_id)).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    comment = IssueComment(
        text=body.text,
        issue_id=issue_id,
        author_id=current_user.id,
    )
    session.add(comment)
    issue.comment_count += 1
    issue.updated_at = get_datetime_utc()
    session.add(issue)
    session.commit()
    session.refresh(comment)
    return comment


@router.get("/projects/{project_id}/reviews", response_model=ReviewsPublic)
def read_project_reviews(session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    reviews = session.exec(
        select(Review)
        .where(Review.project_id == project_id)
        .order_by(Review.created_at.desc())
    ).all()
    return ReviewsPublic(data=reviews, count=len(reviews))


@router.get("/projects/{project_id}/milestones", response_model=ProjectMilestonesPublic)
def read_project_milestones(session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    statement = (
        select(ProjectMilestone)
        .where(ProjectMilestone.project_id == project_id)
        .order_by(ProjectMilestone.sort_order.asc(), ProjectMilestone.created_at.asc())
    )
    milestones = session.exec(statement).all()
    return ProjectMilestonesPublic(data=milestones, count=len(milestones))


@router.post(
    "/projects/{project_id}/milestones",
    response_model=ProjectMilestonePublic,
    status_code=201,
)
def create_project_milestone(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    milestone_in: ProjectMilestoneCreate,
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ensure_project_manager(project=project, actor=current_user)
    ensure_project_manageable(project=project)
    mark_project_in_progress(session=session, project=project)
    milestone = ProjectMilestone.model_validate(
        milestone_in,
        update={"project_id": project_id},
    )
    session.add(milestone)
    session.commit()
    session.refresh(milestone)
    return milestone


@router.patch("/milestones/{milestone_id}", response_model=ProjectMilestonePublic)
def update_project_milestone(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    milestone_id: uuid.UUID,
    milestone_in: ProjectMilestoneUpdate,
) -> Any:
    milestone = session.get(ProjectMilestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    project = session.get(Project, milestone.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ensure_project_manager(project=project, actor=current_user)
    ensure_project_manageable(project=project)
    mark_project_in_progress(session=session, project=project)
    milestone.sqlmodel_update(milestone_in.model_dump(exclude_unset=True))
    session.add(milestone)
    session.commit()
    session.refresh(milestone)
    return milestone


@router.get("/projects/{project_id}/updates", response_model=ProjectUpdatesPublic)
def read_project_updates(session: SessionDep, current_user: CurrentUser, project_id: uuid.UUID) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    statement = (
        select(ProjectUpdateLog)
        .where(ProjectUpdateLog.project_id == project_id)
        .order_by(ProjectUpdateLog.created_at.desc())
    )
    updates = session.exec(statement).all()
    return ProjectUpdatesPublic(
        data=[
            _serialize_project_update(session=session, update=update)
            for update in updates
        ],
        count=len(updates),
    )


@router.post(
    "/projects/{project_id}/updates",
    response_model=ProjectUpdatePublic,
    status_code=201,
)
def create_project_update(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    update_in: ProjectUpdateCreate,
) -> Any:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    ensure_project_manager(project=project, actor=current_user)
    ensure_project_manageable(project=project)
    mark_project_in_progress(session=session, project=project)
    media_rows = _get_owned_update_media(
        session=session,
        current_user=current_user,
        media_keys=update_in.media_keys,
    )
    update = ProjectUpdateLog.model_validate(
        update_in,
        update={"project_id": project_id, "author_id": current_user.id},
    )
    session.add(update)
    session.flush()
    for media in media_rows:
        media.project_update_id = update.id
        session.add(media)
    session.commit()
    session.refresh(update)
    return _serialize_project_update(session=session, update=update)
