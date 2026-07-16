from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.security import create_access_token
from app.models import User, UserCreate, UserUpdate
from tests.utils.utils import random_email, random_lower_string


def user_token_headers(*, user: User) -> dict[str, str]:
    """Return auth headers for a given user, creating a JWT directly."""
    token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=60),
    )
    return {"Authorization": f"Bearer {token}"}


def create_random_user(db: Session) -> User:
    email = random_email()
    password = random_lower_string()
    user_in = UserCreate(email=email, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    return user


def authentication_token_from_email(
    *, client: TestClient, email: str, db: Session
) -> dict[str, str]:
    """
    Return a valid token for the user with given email.
    If the user doesn't exist it is created first.
    """
    _ = client
    password = random_lower_string()
    user = crud.get_user_by_email(session=db, email=email)
    if not user:
        user_in_create = UserCreate(email=email, password=password)
        user = crud.create_user(session=db, user_create=user_in_create)
    else:
        user_in_update = UserUpdate(password=password)
        if not user.id:
            raise Exception("User id not set")
        user = crud.update_user(session=db, db_user=user, user_in=user_in_update)

    return user_token_headers(user=user)
