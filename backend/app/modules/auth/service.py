import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.models import AuthSession, User

AUTH_SESSION_TTL_MINUTES = 5


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 9:
        digits = "998" + digits
    if digits.startswith("8") and len(digits) == 12:
        digits = "998" + digits[1:]
    if not digits.startswith("998") or len(digits) != 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone must be an Uzbekistan number in E.164 format",
        )
    return f"+{digits}"


def _telegram_email(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    return f"{digits}@telegram.platforma.example.com"


def create_telegram_session(
    *, session: Session, phone: str | None, client: str | None, ip: str | None
) -> AuthSession:
    normalized_phone = normalize_phone(phone) if phone else None
    token = secrets.token_urlsafe(32)
    auth_session = AuthSession(
        token=token,
        phone_entered=normalized_phone,
        client=client,
        ip=ip,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=AUTH_SESSION_TTL_MINUTES),
    )
    session.add(auth_session)
    session.commit()
    session.refresh(auth_session)
    return auth_session


def build_deep_link(token: str) -> str:
    username = settings.TG_BOT_USERNAME or "PlatformaBot"
    return f"https://t.me/{username}?start={token}"


def get_auth_session(*, session: Session, token: str) -> AuthSession | None:
    return session.get(AuthSession, token)


def mark_telegram_start_used(*, session: Session, token: str) -> AuthSession:
    auth_session = get_auth_session(session=session, token=token)
    if not auth_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if auth_session.status != "pending":
        return auth_session
    if auth_session.expires_at < datetime.now(timezone.utc):
        auth_session.status = "expired"
    else:
        auth_session.status = "used_start"
    session.add(auth_session)
    session.commit()
    session.refresh(auth_session)
    return auth_session


def refresh_session_status(*, session: Session, auth_session: AuthSession) -> AuthSession:
    if auth_session.status in {"pending", "used_start"} and auth_session.expires_at < datetime.now(timezone.utc):
        auth_session.status = "expired"
        session.add(auth_session)
        session.commit()
        session.refresh(auth_session)
    return auth_session


def verify_telegram_contact(
    *,
    session: Session,
    token: str,
    telegram_id: int,
    phone: str,
    first_name: str | None,
    last_name: str | None,
    username: str | None,
    contact_user_id: int,
    from_user_id: int,
) -> AuthSession:
    if contact_user_id != from_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only the Telegram user's own contact can be used",
        )

    auth_session = get_auth_session(session=session, token=token)
    if not auth_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if auth_session.status not in {"pending", "used_start"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is no longer usable",
        )
    if auth_session.expires_at < datetime.now(timezone.utc):
        auth_session.status = "expired"
        session.add(auth_session)
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session expired")

    normalized_phone = normalize_phone(phone)
    if auth_session.phone_entered and auth_session.phone_entered != normalized_phone:
        auth_session.status = "phone_mismatch"
        session.add(auth_session)
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone mismatch")

    user = session.exec(select(User).where(User.telegram_id == telegram_id)).first()
    if not user:
        user = session.exec(select(User).where(User.phone == normalized_phone)).first()

    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if not user:
        user = User(
            email=_telegram_email(normalized_phone),
            hashed_password=security.get_password_hash(secrets.token_urlsafe(32)),
            full_name=full_name or normalized_phone,
            phone=normalized_phone,
            telegram_id=telegram_id,
            telegram_username=username,
            tg_linked_at=datetime.now(timezone.utc),
            roles=["problem_owner"],
        )
    else:
        user.phone = normalized_phone
        user.telegram_id = telegram_id
        user.telegram_username = username
        user.tg_linked_at = datetime.now(timezone.utc)
        if full_name and not user.full_name:
            user.full_name = full_name

    session.add(user)
    session.commit()
    session.refresh(user)

    auth_session.status = "verified"
    auth_session.telegram_id = telegram_id
    auth_session.user_id = user.id
    session.add(auth_session)
    session.commit()
    session.refresh(auth_session)
    return auth_session


def access_token_for_verified_session(auth_session: AuthSession) -> str | None:
    if auth_session.status != "verified" or not auth_session.user_id:
        return None
    return security.create_access_token(
        auth_session.user_id,
        expires_delta=timedelta(seconds=settings.JWT_ACCESS_TTL_SECONDS),
    )
