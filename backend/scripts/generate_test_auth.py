import json
import uuid
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from app.core.config import settings
from app.core import security as sec
from app.core.db import engine
from app.models import User, RefreshToken

def generate_auth_state():
    with Session(engine) as session:
        # Get first superuser
        user = session.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).first()
        if not user:
            from app.models import UserCreate
            from app import crud
            user_in = UserCreate(
                email=settings.FIRST_SUPERUSER,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                is_superuser=True,
            )
            user = crud.create_user(session=session, user_create=user_in)

        # Generate tokens
        access_token = sec.create_access_token(
            user.id,
            expires_delta=timedelta(seconds=settings.JWT_ACCESS_TTL_SECONDS),
        )
        
        jti = uuid.uuid4()
        family = uuid.uuid4()
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
        
        # Save refresh token to whitelist
        db_token = RefreshToken(
            jti=jti,
            user_id=user.id,
            family=family,
            expires_at=expires_at,
            revoked=False
        )
        session.add(db_token)
        session.commit()
        
        refresh_token = sec.create_refresh_token(
            user.id,
            expires_delta=timedelta(days=settings.JWT_REFRESH_TTL_DAYS),
            jti=jti,
            family=family
        )
        
        # Playwright storage state format
        state = {
            "cookies": [],
            "origins": [
                {
                    "origin": "http://localhost:5173",
                    "localStorage": [
                        {
                            "name": "access_token",
                            "value": access_token
                        },
                        {
                            "name": "refresh_token",
                            "value": refresh_token
                        }
                    ]
                }
            ]
        }
        return state

if __name__ == "__main__":
    print(json.dumps(generate_auth_state()))
