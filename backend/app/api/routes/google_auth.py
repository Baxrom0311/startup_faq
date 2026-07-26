import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import select

from app.api.deps import SessionDep
from app.core import security
from app.core.config import settings
from app.core.limiter import limiter
from app.models import RefreshToken, User

router = APIRouter(prefix="/auth/google", tags=["google-auth"])


class GoogleVerifyRequest(BaseModel):
    credential: str  # Google ID token


class GoogleVerifyResponse(BaseModel):
    access_token: str
    refresh_token: str
    telegram_linked: bool


@router.post("/verify", response_model=GoogleVerifyResponse)
@limiter.limit("10/minute")
async def verify_google_token(
    *, session: SessionDep, request: Request, body: GoogleVerifyRequest
) -> GoogleVerifyResponse:
    # Verify Google ID token via tokeninfo endpoint
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.credential},
        )
    # Fail closed: without a configured client ID we cannot validate the
    # token's audience, so any Google-signed token would be accepted.
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google login is not configured",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token"
        )

    info = resp.json()

    # Verify audience matches our client ID (audience-confusion prevention)
    if info.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token audience mismatch"
        )

    # Verify the issuer is genuinely Google
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token issuer"
        )

    # tokeninfo returns email_verified as the string "true"/"false"
    if info.get("email_verified") not in (True, "true"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google email is not verified",
        )

    google_id = info.get("sub")
    email = info.get("email")
    name = info.get("name") or info.get("given_name") or email

    if not google_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google profile data",
        )

    # Find or create user
    user = session.exec(select(User).where(User.google_id == google_id)).first()
    if not user:
        user = session.exec(select(User).where(User.email == email)).first()

    if not user:
        import secrets as _secrets

        user = User(
            email=email,
            hashed_password=security.get_password_hash(_secrets.token_urlsafe(32)),
            full_name=name,
            google_id=google_id,
            roles=["problem_owner"],
        )
    else:
        if not user.google_id:
            user.google_id = google_id
        if not user.full_name:
            user.full_name = name

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive"
        )

    session.add(user)
    session.commit()
    session.refresh(user)

    # Issue JWT tokens
    access_token = security.create_access_token(
        user.id,
        expires_delta=timedelta(seconds=settings.JWT_ACCESS_TTL_SECONDS),
    )

    jti = uuid.uuid4()
    family = uuid.uuid4()
    new_expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TTL_DAYS
    )
    db_token = RefreshToken(
        jti=jti,
        user_id=user.id,
        family=family,
        expires_at=new_expires_at,
        revoked=False,
        # No AuthSession backs a Google login; the FK column is nullable and
        # a fake "google:..." value would violate the FK to auth_session.token.
        auth_session_token=None,
    )
    session.add(db_token)
    session.commit()

    refresh_token = security.create_refresh_token(
        user.id,
        expires_delta=timedelta(days=settings.JWT_REFRESH_TTL_DAYS),
        jti=jti,
        family=family,
    )

    return GoogleVerifyResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        telegram_linked=user.telegram_id is not None,
    )
