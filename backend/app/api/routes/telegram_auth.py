from fastapi import APIRouter, Header, HTTPException, Request, status

from app.api.deps import SessionDep
from app.core.config import settings
from app.modules.auth.schemas import (
    TelegramAuthStartRequest,
    TelegramAuthStartResponse,
    TelegramAuthStatusResponse,
    TelegramContactVerifyRequest,
)
from app.modules.auth.service import (
    access_token_for_verified_session,
    build_deep_link,
    create_telegram_session,
    get_auth_session,
    mark_telegram_start_used,
    refresh_session_status,
    verify_telegram_contact,
)

router = APIRouter(prefix="/auth/telegram", tags=["telegram-auth"])


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
    return TelegramAuthStatusResponse(
        status=auth_session.status,
        access_token=access_token_for_verified_session(auth_session),
    )


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
    return TelegramAuthStatusResponse(status=auth_session.status)


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
    return TelegramAuthStatusResponse(
        status=auth_session.status,
        access_token=access_token_for_verified_session(auth_session),
    )
