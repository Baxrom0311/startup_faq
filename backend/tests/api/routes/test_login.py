"""
Login endpoint tests.

Note: email/password auth is disabled — the app uses Telegram contact
verification.  The old /login/access-token endpoint now returns 404, so
tests that relied on it have been replaced with direct JWT generation.
"""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.crud import create_user
from app.models import User, UserCreate
from app.utils import generate_password_reset_token
from tests.utils.utils import random_email, random_lower_string

from datetime import timedelta


def test_login_endpoint_disabled(client: TestClient) -> None:
    """The old email/password login endpoint must return 404."""
    r = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": settings.FIRST_SUPERUSER, "password": "any"},
    )
    assert r.status_code == 404


def test_test_token_with_valid_jwt(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=superuser_token_headers,
    )
    result = r.json()
    assert r.status_code == 200
    assert "email" in result


def test_recovery_password_endpoint_disabled(client: TestClient) -> None:
    """Password recovery must return 404 (Telegram auth only)."""
    r = client.post(f"{settings.API_V1_STR}/password-recovery/test@example.com")
    assert r.status_code == 404


def test_reset_password_endpoint_disabled(client: TestClient) -> None:
    """Password reset must return 404 (Telegram auth only)."""
    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        json={"new_password": random_lower_string(), "token": "invalid"},
    )
    assert r.status_code == 404


def test_reset_password_invalid_token_via_html_endpoint(
    client: TestClient, db: Session
) -> None:
    """The HTML password-recovery endpoint still validates the token."""
    email = random_email()
    user_in = UserCreate(email=email, password=random_lower_string())
    create_user(session=db, user_create=user_in)

    # Use a superuser token to call the HTML endpoint
    from datetime import timedelta
    from app.crud import get_user_by_email
    admin = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert admin
    token = create_access_token(subject=str(admin.id), expires_delta=timedelta(minutes=5))
    headers = {"Authorization": f"Bearer {token}"}

    r = client.post(
        f"{settings.API_V1_STR}/password-recovery-html-content/{email}",
        headers=headers,
    )
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
