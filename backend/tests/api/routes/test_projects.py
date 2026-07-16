"""Projects endpoint tests."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Problem, Project, User
from tests.utils.user import create_random_user, user_token_headers
from tests.utils.utils import random_lower_string


def _make_problem(session: Session, author: User, status: str = "published") -> Problem:
    problem = Problem(
        author_id=author.id,
        raw_text="test problem " + random_lower_string(),
        status=status,
    )
    session.add(problem)
    session.commit()
    session.refresh(problem)
    return problem


def _make_project(
    session: Session,
    problem: Problem,
    lead: User,
    status: str = "proposed",
) -> Project:
    project = Project(
        problem_id=problem.id,
        lead_id=lead.id,
        title="Test Project " + random_lower_string(),
        status=status,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


# ---------------------------------------------------------------------------
# POST /problems/{id}/claim
# ---------------------------------------------------------------------------

def test_claim_requires_auth(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/claim",
        json={"title": "My project"},
    )
    assert r.status_code == 401


def test_claim_published_problem(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")
    lead = create_random_user(db)
    headers = user_token_headers(user=lead)

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/claim",
        headers=headers,
        json={"title": "My project", "pitch": "We will solve this"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "proposed"
    assert data["problem_id"] == str(problem.id)
    assert data["lead_id"] == str(lead.id)


def test_claim_non_published_problem_conflict(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="ai_processing")
    lead = create_random_user(db)
    headers = user_token_headers(user=lead)

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/claim",
        headers=headers,
        json={"title": "My project"},
    )
    assert r.status_code == 409


def test_claim_same_problem_twice_conflict(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")
    lead = create_random_user(db)
    headers = user_token_headers(user=lead)

    r1 = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/claim",
        headers=headers,
        json={"title": "First attempt"},
    )
    assert r1.status_code == 201

    r2 = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/claim",
        headers=headers,
        json={"title": "Second attempt"},
    )
    assert r2.status_code == 409


def test_claim_nonexistent_problem(client: TestClient, db: Session) -> None:
    lead = create_random_user(db)
    headers = user_token_headers(user=lead)

    r = client.post(
        f"{settings.API_V1_STR}/problems/{uuid.uuid4()}/claim",
        headers=headers,
        json={"title": "My project"},
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /projects
# ---------------------------------------------------------------------------

def test_read_projects_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/projects")
    assert r.status_code == 401


def test_read_projects(client: TestClient, normal_user_token_headers: dict[str, str], db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    _make_project(db, problem, lead)

    r = client.get(f"{settings.API_V1_STR}/projects", headers=normal_user_token_headers)
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "count" in data
    assert data["count"] >= 1


def test_read_projects_mine_filter(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    _make_project(db, problem, lead)
    headers = user_token_headers(user=lead)

    r = client.get(f"{settings.API_V1_STR}/projects?mine=true", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    for item in data["data"]:
        assert item["lead_id"] == str(lead.id)


# ---------------------------------------------------------------------------
# GET /projects/{id}
# ---------------------------------------------------------------------------

def test_read_project_requires_auth(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    project = _make_project(db, problem, lead)

    r = client.get(f"{settings.API_V1_STR}/projects/{project.id}")
    assert r.status_code == 401


def test_read_project(client: TestClient, normal_user_token_headers: dict[str, str], db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    project = _make_project(db, problem, lead)

    r = client.get(
        f"{settings.API_V1_STR}/projects/{project.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(project.id)


def test_read_project_not_found(client: TestClient, normal_user_token_headers: dict[str, str]) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/projects/{uuid.uuid4()}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /projects/{id}/approve
# ---------------------------------------------------------------------------

def test_approve_project_by_problem_owner(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="proposed")

    author_headers = user_token_headers(user=author)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/approve",
        headers=author_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "approved"


def test_approve_project_by_superuser(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="proposed")

    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/approve",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "approved"


def test_approve_project_by_other_user_forbidden(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="proposed")

    stranger = create_random_user(db)
    stranger_headers = user_token_headers(user=stranger)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/approve",
        headers=stranger_headers,
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# POST /projects/{id}/reject
# ---------------------------------------------------------------------------

def test_reject_project_by_problem_owner(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="proposed")

    author_headers = user_token_headers(user=author)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/reject",
        headers=author_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"


def test_reject_project_by_other_user_forbidden(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="proposed")

    stranger = create_random_user(db)
    stranger_headers = user_token_headers(user=stranger)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/reject",
        headers=stranger_headers,
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# POST /projects/{id}/start-piloting
# ---------------------------------------------------------------------------

def test_start_piloting_by_lead(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="claimed")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    lead_headers = user_token_headers(user=lead)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/start-piloting",
        headers=lead_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "piloting"


def test_start_piloting_by_other_user_forbidden(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="claimed")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    stranger = create_random_user(db)
    stranger_headers = user_token_headers(user=stranger)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/start-piloting",
        headers=stranger_headers,
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# GET /projects/{id}/milestones  &  POST /projects/{id}/milestones
# ---------------------------------------------------------------------------

def test_read_milestones_requires_auth(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    project = _make_project(db, problem, lead)

    r = client.get(f"{settings.API_V1_STR}/projects/{project.id}/milestones")
    assert r.status_code == 401


def test_read_milestones_empty(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    r = client.get(
        f"{settings.API_V1_STR}/projects/{project.id}/milestones",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["data"] == []
    assert data["count"] == 0


def test_create_milestone_by_lead(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="claimed")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    lead_headers = user_token_headers(user=lead)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/milestones",
        headers=lead_headers,
        json={"title": "MVP launch", "status": "todo"},
    )
    assert r.status_code == 201
    assert r.json()["title"] == "MVP launch"
    assert r.json()["project_id"] == str(project.id)


def test_create_milestone_by_non_lead_forbidden(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="claimed")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    stranger = create_random_user(db)
    stranger_headers = user_token_headers(user=stranger)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/milestones",
        headers=stranger_headers,
        json={"title": "MVP launch", "status": "todo"},
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# GET /projects/{id}/updates  &  POST /projects/{id}/updates
# ---------------------------------------------------------------------------

def test_read_updates_requires_auth(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    project = _make_project(db, problem, lead)

    r = client.get(f"{settings.API_V1_STR}/projects/{project.id}/updates")
    assert r.status_code == 401


def test_read_updates_empty(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    r = client.get(
        f"{settings.API_V1_STR}/projects/{project.id}/updates",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["data"] == []
    assert data["count"] == 0


def test_create_update_by_lead(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="claimed")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    lead_headers = user_token_headers(user=lead)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/updates",
        headers=lead_headers,
        json={"text": "Week 1 progress: set up infrastructure", "media_keys": []},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["text"] == "Week 1 progress: set up infrastructure"
    assert data["author_id"] == str(lead.id)
    assert data["media"] == []


def test_create_update_by_non_lead_forbidden(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="claimed")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    stranger = create_random_user(db)
    stranger_headers = user_token_headers(user=stranger)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/updates",
        headers=stranger_headers,
        json={"text": "Sneaky update", "media_keys": []},
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# GET /projects/{id}/reviews  &  POST /projects/{id}/complete
# ---------------------------------------------------------------------------

def test_read_reviews_requires_auth(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    project = _make_project(db, problem, lead)

    r = client.get(f"{settings.API_V1_STR}/projects/{project.id}/reviews")
    assert r.status_code == 401


def test_read_reviews_empty(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author)
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="approved")

    r = client.get(
        f"{settings.API_V1_STR}/projects/{project.id}/reviews",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["data"] == []
    assert data["count"] == 0


def test_complete_project_by_problem_owner(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="piloting")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="piloting")

    author_headers = user_token_headers(user=author)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/complete",
        headers=author_headers,
        json={"rating": 5, "text": "Excellent work!"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["rating"] == 5
    assert data["project_id"] == str(project.id)
    assert data["reviewer_id"] == str(author.id)


def test_complete_project_by_other_user_forbidden(client: TestClient, db: Session) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="piloting")
    lead = create_random_user(db)
    project = _make_project(db, problem, lead, status="piloting")

    stranger = create_random_user(db)
    stranger_headers = user_token_headers(user=stranger)
    r = client.post(
        f"{settings.API_V1_STR}/projects/{project.id}/complete",
        headers=stranger_headers,
        json={"rating": 3, "text": "Meh"},
    )
    assert r.status_code == 403
