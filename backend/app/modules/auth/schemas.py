from datetime import datetime

from sqlmodel import SQLModel


class TelegramAuthStartRequest(SQLModel):
    phone: str | None = None
    client: str | None = "web"


class TelegramAuthStartResponse(SQLModel):
    session_id: str
    deep_link: str
    expires_at: datetime


class TelegramAuthStatusResponse(SQLModel):
    status: str
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_at: datetime | None = None
    retry_after_seconds: int | None = None


class TokenRefreshRequest(SQLModel):
    refresh_token: str


class TokenRefreshResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TelegramContactVerifyRequest(SQLModel):
    token: str
    telegram_id: int
    phone: str
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    contact_user_id: int
    from_user_id: int
