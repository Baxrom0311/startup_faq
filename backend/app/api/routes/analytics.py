from datetime import datetime, timedelta, timezone
import json
from typing import Any
from fastapi import APIRouter
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep, RedisDep
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
async def read_analytics_overview(
    session: SessionDep,
    redis: RedisDep,
    current_user: CurrentUser,
) -> AnalyticsOverview:
    _ = current_user
    cache_key = "analytics:overview"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return AnalyticsOverview.model_validate_json(cached)
    except Exception:
        pass

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

    data = AnalyticsOverview(
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

    try:
        await redis.setex(cache_key, 60, data.model_dump_json())
    except Exception:
        pass

    return data


@router.get("/by-sector")
async def read_analytics_by_sector(
    session: SessionDep,
    redis: RedisDep,
    current_user: CurrentUser,
) -> list[dict]:
    _ = current_user
    cache_key = "analytics:by-sector"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

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
    data = [
        {
            "sector_id": r[0],
            "name_uz": r[1],
            "name_ru": r[2],
            "name_en": r[3],
            "problem_count": r[4],
        }
        for r in results
    ]

    try:
        await redis.setex(cache_key, 60, json.dumps(data))
    except Exception:
        pass

    return data


@router.get("/trend")
async def read_analytics_trend(
    session: SessionDep,
    redis: RedisDep,
    current_user: CurrentUser,
    days: int = 30,
) -> list[dict]:
    _ = current_user
    cache_key = f"analytics:trend:days:{days}"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

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
    data = [
        {
            "date": str(r[0]),
            "count": r[1],
        }
        for r in results
    ]

    try:
        await redis.setex(cache_key, 60, json.dumps(data))
    except Exception:
        pass

    return data
