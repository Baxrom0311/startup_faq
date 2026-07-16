"""Problems endpoint tests."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Comment, Problem, User
from tests.utils.user import create_random_user, user_token_headers
from tests.utils.utils import random_lower_string


def _make_problem(
    session: Session,
    author: User,
    status: str = "published",
    raw_text: str | None = None,
) -> Problem:
    problem = Problem(
        author_id=author.id,
        raw_text=raw_text or random_lower_string(),
        status=status,
    )
    session.add(problem)
    session.commit()
    session.refresh(problem)
    return problem


# ---------------------------------------------------------------------------
# POST /problems/
# ---------------------------------------------------------------------------

def test_create_problem_requires_auth(client: TestClient) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/problems/",
        json={"raw_text": "some problem"},
    )
    assert r.status_code == 401


def test_create_problem(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/problems/",
        headers=normal_user_token_headers,
        json={"raw_text": "unique test problem " + random_lower_string()},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "published"
    assert "id" in data


def test_create_problem_dedup_returns_existing(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    """Submitting the same text twice votes on the first problem."""
    text = "duplicate test " + random_lower_string()
    r1 = client.post(
        f"{settings.API_V1_STR}/problems/",
        headers=normal_user_token_headers,
        json={"raw_text": text},
    )
    assert r1.status_code == 201
    first_id = r1.json()["id"]

    r2 = client.post(
        f"{settings.API_V1_STR}/problems/",
        headers=normal_user_token_headers,
        json={"raw_text": text},
    )
    assert r2.status_code == 201
    data2 = r2.json()
    assert data2["id"] == first_id
    assert data2["is_duplicate"] is True


# ---------------------------------------------------------------------------
# GET /problems/
# ---------------------------------------------------------------------------

def test_read_problems_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/problems/")
    assert r.status_code == 401


def test_read_problems_published(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)
    _make_problem(db, user, status="published")

    r = client.get(
        f"{settings.API_V1_STR}/problems/?status=published",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert data["count"] >= 1
    for item in data["data"]:
        assert item["status"] == "published"


def test_read_problems_draft_status_forbidden_for_normal_user(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    """Normal users cannot list problems with non-public status unless mine=true."""
    r = client.get(
        f"{settings.API_V1_STR}/problems/?status=draft",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403


def test_read_problems_mine_allows_any_status(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/problems/?status=ai_processing&mine=true",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200


def test_read_problems_admin_sees_any_status(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)
    _make_problem(db, user, status="needs_review")

    r = client.get(
        f"{settings.API_V1_STR}/problems/?status=needs_review",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["count"] >= 1


def test_read_problems_search(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)
    unique = "xyzuniquesearchterm" + random_lower_string()
    _make_problem(db, user, status="published", raw_text=unique)

    r = client.get(
        f"{settings.API_V1_STR}/problems/?status=published&q={unique}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    assert any(unique in (item.get("raw_text") or "") for item in data["data"])


# ---------------------------------------------------------------------------
# GET /problems/{id}
# ---------------------------------------------------------------------------

def test_read_problem_public(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")

    r = client.get(
        f"{settings.API_V1_STR}/problems/{problem.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(problem.id)


def test_read_problem_requires_auth(client: TestClient, db: Session) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")

    r = client.get(f"{settings.API_V1_STR}/problems/{problem.id}")
    assert r.status_code == 401


def test_read_problem_draft_hidden_from_others(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    """A draft problem is not visible to users who are not the author."""
    author = create_random_user(db)
    problem = _make_problem(db, author, status="draft")

    r = client.get(
        f"{settings.API_V1_STR}/problems/{problem.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 404


def test_read_problem_draft_visible_to_author(client: TestClient, db: Session) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="draft")
    headers = user_token_headers(user=user)

    r = client.get(f"{settings.API_V1_STR}/problems/{problem.id}", headers=headers)
    assert r.status_code == 200


def test_read_problem_not_found(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/problems/{uuid.uuid4()}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Admin actions: publish / archive
# ---------------------------------------------------------------------------

def test_publish_problem_admin_only(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="needs_review")

    # Normal user cannot publish
    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/publish",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403

    # Admin can publish
    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/publish",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "published"


def test_archive_problem_admin_only(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/archive",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/archive",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "archived"


def test_solve_problem_by_author(client: TestClient, db: Session) -> None:
    user = create_random_user(db)
    # "solved" is only reachable from "piloting" per ALLOWED_TRANSITIONS
    problem = _make_problem(db, user, status="piloting")
    headers = user_token_headers(user=user)

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/solve",
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "solved"


def test_solve_problem_by_other_user_forbidden(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    author = create_random_user(db)
    problem = _make_problem(db, author, status="published")

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/solve",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Voting
# ---------------------------------------------------------------------------

def test_vote_and_unvote(client: TestClient, db: Session) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")
    headers = user_token_headers(user=user)

    # Vote
    r = client.put(
        f"{settings.API_V1_STR}/problems/{problem.id}/vote",
        headers=headers,
    )
    assert r.status_code == 204

    # Get problem — vote_count should be 1
    r = client.get(f"{settings.API_V1_STR}/problems/{problem.id}", headers=headers)
    assert r.json()["vote_count"] == 1
    assert r.json()["has_voted"] is True

    # Unvote
    r = client.delete(
        f"{settings.API_V1_STR}/problems/{problem.id}/vote",
        headers=headers,
    )
    assert r.status_code == 200

    r = client.get(f"{settings.API_V1_STR}/problems/{problem.id}", headers=headers)
    assert r.json()["vote_count"] == 0
    assert r.json()["has_voted"] is False


def test_vote_requires_auth(client: TestClient, db: Session) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")

    r = client.put(f"{settings.API_V1_STR}/problems/{problem.id}/vote")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

def test_read_comments(client: TestClient, db: Session) -> None:
    """Comments are publicly readable (no auth required)."""
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")
    comment = Comment(problem_id=problem.id, user_id=user.id, text="hello")
    db.add(comment)
    db.commit()

    r = client.get(f"{settings.API_V1_STR}/problems/{problem.id}/comments")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    assert any(c["text"] == "hello" for c in data["data"])


def test_create_comment_requires_auth(client: TestClient, db: Session) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/comments",
        json={"text": "no auth"},
    )
    assert r.status_code == 401


def test_create_comment(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")

    r = client.post(
        f"{settings.API_V1_STR}/problems/{problem.id}/comments",
        headers=normal_user_token_headers,
        json={"text": "great problem"},
    )
    assert r.status_code == 201
    assert r.json()["text"] == "great problem"


# ---------------------------------------------------------------------------
# Media
# ---------------------------------------------------------------------------

def test_read_problem_media_requires_auth(client: TestClient, db: Session) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")

    r = client.get(f"{settings.API_V1_STR}/problems/{problem.id}/media")
    assert r.status_code == 401


def test_read_problem_media_empty(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)
    problem = _make_problem(db, user, status="published")

    r = client.get(
        f"{settings.API_V1_STR}/problems/{problem.id}/media",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["data"] == []
    assert r.json()["count"] == 0


# ---------------------------------------------------------------------------
# Merge (admin)
# ---------------------------------------------------------------------------

def test_merge_problem_admin_only(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    user = create_random_user(db)
    source = _make_problem(db, user, status="published")
    target = _make_problem(db, user, status="published")

    r = client.post(
        f"{settings.API_V1_STR}/problems/{source.id}/merge",
        headers=normal_user_token_headers,
        json={"target_problem_id": str(target.id)},
    )
    assert r.status_code == 403

    r = client.post(
        f"{settings.API_V1_STR}/problems/{source.id}/merge",
        headers=superuser_token_headers,
        json={"target_problem_id": str(target.id)},
    )
    assert r.status_code == 200
    # source is now archived, response is the target
    db.refresh(source)
    assert source.status == "archived"
    assert source.duplicate_of == target.id
