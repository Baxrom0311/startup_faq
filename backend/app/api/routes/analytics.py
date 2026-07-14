from fastapi import APIRouter
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Problem, Project
from app.modules.analytics.schemas import AnalyticsOverview

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _count_problems(session: SessionDep, *statuses: str) -> int:
    return session.exec(
        select(func.count()).select_from(Problem).where(Problem.status.in_(statuses))
    ).one()


def _count_projects(session: SessionDep, *statuses: str) -> int:
    return session.exec(
        select(func.count()).select_from(Project).where(Project.status.in_(statuses))
    ).one()


@router.get("/overview", response_model=AnalyticsOverview)
def read_analytics_overview(
    session: SessionDep,
    current_user: CurrentUser,
) -> AnalyticsOverview:
    _ = current_user
    submitted = session.exec(select(func.count()).select_from(Problem)).one()
    published = _count_problems(session, "published")
    claimed = _count_problems(session, "claimed")
    piloting = _count_problems(session, "piloting")
    solved = _count_problems(session, "solved")
    proposed_projects = _count_projects(session, "proposed")
    active_projects = _count_projects(session, "approved", "in_progress", "piloting")
    completed_projects = _count_projects(session, "completed")

    return AnalyticsOverview(
        submitted_problems=submitted,
        published_problems=published,
        claimed_problems=claimed,
        piloting_problems=piloting,
        solved_problems=solved,
        proposed_projects=proposed_projects,
        active_projects=active_projects,
        completed_projects=completed_projects,
        problem_to_claim_rate=round((claimed + piloting + solved) / submitted, 4)
        if submitted
        else 0,
        claim_to_solved_rate=round(solved / (claimed + piloting + solved), 4)
        if claimed + piloting + solved
        else 0,
    )
