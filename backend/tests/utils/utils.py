import random
import string
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.crud import get_user_by_email


def random_lower_string() -> str:
    return "".join(random.choices(string.ascii_lowercase, k=32))


def random_email() -> str:
    return f"{random_lower_string()}@{random_lower_string()}.com"


def get_superuser_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    """Return auth headers for the first superuser, creating a JWT directly."""
    _ = client
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None, "Superuser not found in DB"
    token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=60),
    )
    return {"Authorization": f"Bearer {token}"}
