"""Analytics endpoint tests."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Problem, User
from tests.utils.user import create_random_user, user_token_headers


def _make_problem(session: Session, author: User, status: str = "published") -> Problem:
    problem = Problem(author_id=author.id, raw_text="test problem", status=status)
    session.add(problem)
    session.commit()
    session.refresh(problem)
    return problem


def test_analytics_overview_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/analytics/overview")
    assert r.status_code == 401


def test_analytics_overview_shape(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/analytics/overview",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    expected_keys = {
        "submitted_problems",
        "ai_processing_problems",
        "needs_review_problems",
        "published_problems",
        "claimed_problems",
        "piloting_problems",
        "solved_problems",
        "proposed_projects",
        "active_projects",
        "completed_projects",
        "problem_to_claim_rate",
        "claim_to_solved_rate",
    }
    assert expected_keys <= set(data.keys())


def test_analytics_overview_counts_problems(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)
    _make_problem(db, user, status="published")
    _make_problem(db, user, status="published")
    _make_problem(db, user, status="solved")

    r = client.get(
        f"{settings.API_V1_STR}/analytics/overview",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    # At least 2 published and 1 solved must be reflected (DB may have more from other tests)
    assert data["published_problems"] >= 2
    assert data["solved_problems"] >= 1
    assert data["submitted_problems"] >= 3


def test_analytics_overview_normal_user(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    """Any authenticated user can view analytics."""
    r = client.get(
        f"{settings.API_V1_STR}/analytics/overview",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
