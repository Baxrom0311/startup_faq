from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models import AuthSession
from app.modules.auth.service import (
    normalize_phone,
    refresh_session_status,
    verify_telegram_contact,
)


class DummySession:
    def __init__(self) -> None:
        self.objects: list[object] = []
        self.committed = False

    def add(self, obj: object) -> None:
        self.objects.append(obj)

    def commit(self) -> None:
        self.committed = True

    def refresh(self, obj: object) -> None:
        _ = obj


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("901234567", "+998901234567"),
        ("+998 90 123 45 67", "+998901234567"),
        ("998901234567", "+998901234567"),
    ],
)
def test_normalize_uzbek_phone(raw: str, expected: str) -> None:
    assert normalize_phone(raw) == expected


def test_normalize_phone_rejects_invalid_number() -> None:
    with pytest.raises(HTTPException):
        normalize_phone("123")


def test_refresh_session_status_expires_stale_pending_session() -> None:
    session = DummySession()
    auth_session = AuthSession(
        token="token",
        status="pending",
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )

    result = refresh_session_status(
        session=session,  # type: ignore[arg-type]
        auth_session=auth_session,
    )

    assert result.status == "expired"
    assert session.committed is True


def test_verify_telegram_contact_rejects_forwarded_contact() -> None:
    with pytest.raises(HTTPException):
        verify_telegram_contact(
            session=DummySession(),  # type: ignore[arg-type]
            token="token",
            telegram_id=1,
            phone="+998901234567",
            first_name=None,
            last_name=None,
            username=None,
            contact_user_id=2,
            from_user_id=1,
        )
