from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.models import Message, NewPassword, Token, UserPublic
from app.utils import (
    generate_password_reset_token,
    generate_reset_password_email,
)

router = APIRouter(tags=["login"])


def _telegram_auth_only() -> None:
    raise HTTPException(status_code=404, detail="Telegram auth only")


@router.post("/login/access-token")
def login_access_token() -> Token:
    """
    Disabled: SolutionLab uses Telegram contact verification for login.
    """
    _telegram_auth_only()


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> Any:
    """
    Test access token
    """
    return current_user


@router.post("/password-recovery/{email}")
def recover_password(email: str, session: SessionDep) -> Message:
    """
    Disabled: SolutionLab uses Telegram contact verification for login.
    """
    _ = (email, session)
    _telegram_auth_only()


@router.post("/reset-password/")
def reset_password(session: SessionDep, body: NewPassword) -> Message:
    """
    Disabled: SolutionLab uses Telegram contact verification for login.
    """
    _ = (session, body)
    _telegram_auth_only()


@router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_superuser)],
    response_class=HTMLResponse,
)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    """
    HTML Content for Password Recovery
    """
    user = crud.get_user_by_email(session=session, email=email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this username does not exist in the system.",
        )
    password_reset_token = generate_password_reset_token(email=email)
    email_data = generate_reset_password_email(
        email_to=user.email, email=email, token=password_reset_token
    )

    return HTMLResponse(
        content=email_data.html_content, headers={"subject:": email_data.subject}
    )
