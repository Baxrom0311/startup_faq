from collections.abc import AsyncGenerator, Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from redis.asyncio import Redis
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import TokenPayload, User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def decode_token_user(session: Session, token: str) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    # Refresh tokens must never authenticate API requests — only the
    # /auth/*/refresh endpoint may consume them. (Legacy access tokens have
    # no "type" claim and are still accepted.)
    if payload.get("type") == "refresh":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    return decode_token_user(session, token)


def get_current_user_from_token_query(session: SessionDep, token: str | None = None) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    return decode_token_user(session, token)


_optional_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token", auto_error=False
)


def get_optional_current_user(
    session: SessionDep, token: Annotated[str | None, Depends(_optional_oauth2)] = None
) -> User | None:
    """Return the authenticated user if a valid token is present, else None.
    Used by endpoints that are public for public resources but must still apply
    per-user visibility rules when a token is supplied."""
    if not token:
        return None
    return decode_token_user(session, token)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserFromQuery = Annotated[User, Depends(get_current_user_from_token_query)]
OptionalCurrentUser = Annotated[User | None, Depends(get_optional_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


async def get_redis() -> AsyncGenerator[Redis, None]:
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


RedisDep = Annotated[Redis, Depends(get_redis)]
