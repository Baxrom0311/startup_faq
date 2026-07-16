from datetime import timedelta

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.api.deps import SessionDep
from app.core.config import settings
from app.models import Message
from app.modules.auth.schemas import (
    TelegramAuthStartRequest,
    TelegramAuthStartResponse,
    TelegramAuthStatusResponse,
    TelegramContactVerifyRequest,
    TokenRefreshRequest,
    TokenRefreshResponse,
)
from app.modules.auth.service import (
    access_token_for_verified_session,
    build_deep_link,
    create_telegram_session,
    get_auth_session,
    mark_telegram_start_used,
    refresh_session_status,
    refresh_token_for_verified_session,
    verify_telegram_contact,
)

router = APIRouter(prefix="/auth/telegram", tags=["telegram-auth"])


def _status_response(session: SessionDep, auth_session) -> TelegramAuthStatusResponse:
    retry_after_seconds = 2 if auth_session.status in {"pending", "used_start"} else None
    return TelegramAuthStatusResponse(
        status=auth_session.status,
        access_token=access_token_for_verified_session(auth_session),
        refresh_token=refresh_token_for_verified_session(session, auth_session),
        expires_at=auth_session.expires_at,
        retry_after_seconds=retry_after_seconds,
    )


@router.post("/start", response_model=TelegramAuthStartResponse)
def start_telegram_auth(
    *, session: SessionDep, request: Request, body: TelegramAuthStartRequest
) -> TelegramAuthStartResponse:
    auth_session = create_telegram_session(
        session=session,
        phone=body.phone,
        client=body.client,
        ip=request.client.host if request.client else None,
    )
    return TelegramAuthStartResponse(
        session_id=auth_session.token,
        deep_link=build_deep_link(auth_session.token),
        expires_at=auth_session.expires_at,
    )


@router.get("/status/{session_id}", response_model=TelegramAuthStatusResponse)
def telegram_auth_status(
    *, session: SessionDep, session_id: str
) -> TelegramAuthStatusResponse:
    auth_session = get_auth_session(session=session, token=session_id)
    if not auth_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    auth_session = refresh_session_status(session=session, auth_session=auth_session)
    return _status_response(session, auth_session)


@router.post("/mark-start/{session_id}", response_model=TelegramAuthStatusResponse)
def mark_start(
    *,
    session: SessionDep,
    session_id: str,
    x_telegram_webhook_secret: str | None = Header(default=None),
) -> TelegramAuthStatusResponse:
    if settings.TG_WEBHOOK_SECRET and x_telegram_webhook_secret != settings.TG_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid bot secret")
    auth_session = mark_telegram_start_used(session=session, token=session_id)
    return _status_response(session, auth_session)


@router.post("/verify-contact", response_model=TelegramAuthStatusResponse)
def verify_contact(
    *,
    session: SessionDep,
    body: TelegramContactVerifyRequest,
    x_telegram_webhook_secret: str | None = Header(default=None),
) -> TelegramAuthStatusResponse:
    if settings.TG_WEBHOOK_SECRET and x_telegram_webhook_secret != settings.TG_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid bot secret")

    auth_session = verify_telegram_contact(
        session=session,
        token=body.token,
        telegram_id=body.telegram_id,
        phone=body.phone,
        first_name=body.first_name,
        last_name=body.last_name,
        username=body.username,
        contact_user_id=body.contact_user_id,
        from_user_id=body.from_user_id,
    )
    return _status_response(session, auth_session)


@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_access_token(
    *, session: SessionDep, body: TokenRefreshRequest
) -> TokenRefreshResponse:
    """Exchange a valid refresh token for a new access token, with rotation and revocation."""
    from app.core import security as sec
    from app.models import User, RefreshToken
    from sqlmodel import select
    from datetime import datetime, timezone
    import uuid

    try:
        payload = sec.decode_refresh_token(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )

    user_id = payload.get("sub")
    jti_str = payload.get("jti")
    family_str = payload.get("family")

    try:
        jti = uuid.UUID(jti_str)
        family = uuid.UUID(family_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed refresh token claims",
        )

    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Check whitelist in DB
    db_token = session.get(RefreshToken, jti)

    # Reuse detection (token is already revoked)
    if not db_token or db_token.revoked:
        if db_token:
            # Revoke entire family!
            family_tokens = session.exec(
                select(RefreshToken).where(RefreshToken.family == db_token.family)
            ).all()
            for t in family_tokens:
                t.revoked = True
                session.add(t)
            session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token",
        )

    # Valid token -> rotate!
    # 1. Revoke the used token
    db_token.revoked = True
    session.add(db_token)

    # 2. Create a new token in the same family
    new_jti = uuid.uuid4()
    new_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)

    new_db_token = RefreshToken(
        jti=new_jti,
        user_id=user.id,
        family=family,
        expires_at=new_expires_at,
        revoked=False,
        auth_session_token=db_token.auth_session_token,
    )
    session.add(new_db_token)
    session.commit()

    # 3. Generate new JWTs
    access_token = sec.create_access_token(
        user.id,
        expires_delta=timedelta(seconds=settings.JWT_ACCESS_TTL_SECONDS),
    )
    new_refresh_token = sec.create_refresh_token(
        user.id,
        expires_delta=timedelta(days=settings.JWT_REFRESH_TTL_DAYS),
        jti=new_jti,
        family=family,
    )

    return TokenRefreshResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout", response_model=Message)
def logout(
    *, session: SessionDep, body: TokenRefreshRequest
) -> Message:
    """Revoke the provided refresh token to log out."""
    from app.core import security as sec
    from app.models import RefreshToken
    import uuid

    try:
        payload = sec.decode_refresh_token(body.refresh_token)
    except ValueError:
        # If token is invalid or expired anyway, logout is successful
        return Message(message="Successfully logged out")

    jti_str = payload.get("jti")
    try:
        jti = uuid.UUID(jti_str)
    except (ValueError, TypeError):
        return Message(message="Successfully logged out")

    db_token = session.get(RefreshToken, jti)
    if db_token:
        db_token.revoked = True
        session.add(db_token)
        session.commit()

    return Message(message="Successfully logged out")
