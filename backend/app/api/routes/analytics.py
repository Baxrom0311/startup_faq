from datetime import datetime, timedelta, timezone
from fastapi import APIRouter
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Problem, Project, Sector
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
    ai_processing = _count_problems(session, "ai_processing")
    needs_review = _count_problems(session, "needs_review")
    published = _count_problems(session, "published")
    claimed = _count_problems(session, "claimed")
    piloting = _count_problems(session, "piloting")
    solved = _count_problems(session, "solved")
    proposed_projects = _count_projects(session, "proposed")
    active_projects = _count_projects(session, "approved", "in_progress", "piloting")
    completed_projects = _count_projects(session, "completed")

    return AnalyticsOverview(
        submitted_problems=submitted,
        ai_processing_problems=ai_processing,
        needs_review_problems=needs_review,
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


@router.get("/by-sector")
def read_analytics_by_sector(
    session: SessionDep,
    current_user: CurrentUser,
) -> list[dict]:
    _ = current_user
    stmt = (
        select(
            Sector.id,
            Sector.name_uz,
            Sector.name_ru,
            Sector.name_en,
            func.count(Problem.id).label("problem_count"),
        )
        .join(Problem, Problem.sector_id == Sector.id, isouter=True)
        .group_by(Sector.id)
        .order_by(func.count(Problem.id).desc())
    )
    results = session.exec(stmt).all()
    return [
        {
            "sector_id": r[0],
            "name_uz": r[1],
            "name_ru": r[2],
            "name_en": r[3],
            "problem_count": r[4],
        }
        for r in results
    ]


@router.get("/trend")
def read_analytics_trend(
    session: SessionDep,
    current_user: CurrentUser,
    days: int = 30,
) -> list[dict]:
    _ = current_user
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    stmt = (
        select(
            func.date(Problem.created_at).label("day"),
            func.count(Problem.id).label("count"),
        )
        .where(Problem.created_at >= start_date)
        .group_by(func.date(Problem.created_at))
        .order_by(func.date(Problem.created_at).asc())
    )
    results = session.exec(stmt).all()
    return [
        {
            "date": str(r[0]),
            "count": r[1],
        }
        for r in results
    ]
