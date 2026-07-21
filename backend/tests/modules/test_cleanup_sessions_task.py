import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from sqlmodel import Session

from app.models import AuthSession, RefreshToken
from app.worker.tasks import cleanup_sessions
from app.worker.tasks.cleanup_sessions import cleanup_expired_sessions
from tests.utils.user import create_random_user


def test_cleanup_expired_sessions(db: Session, monkeypatch) -> None:
    user = create_random_user(db)
    now = datetime.now(timezone.utc)
    
    # 1. Create expired and active sessions
    expired_sess_token = f"expired_{uuid.uuid4()}"
    active_sess_token = f"active_{uuid.uuid4()}"
    
    expired_session = AuthSession(
        token=expired_sess_token,
        phone_entered="+998901111111",
        status="pending",
        user_id=user.id,
        expires_at=now - timedelta(minutes=10),
    )
    active_session = AuthSession(
        token=active_sess_token,
        phone_entered="+998902222222",
        status="pending",
        user_id=user.id,
        expires_at=now + timedelta(minutes=10),
    )
    
    db.add(expired_session)
    db.add(active_session)
    db.commit()
    
    # 2. Create expired and active refresh tokens
    expired_token = RefreshToken(
        jti=uuid.uuid4(),
        user_id=user.id,
        family=uuid.uuid4(),
        expires_at=now - timedelta(minutes=10),
        auth_session_token=expired_sess_token,
    )
    active_token = RefreshToken(
        jti=uuid.uuid4(),
        user_id=user.id,
        family=uuid.uuid4(),
        expires_at=now + timedelta(minutes=10),
        auth_session_token=active_sess_token,
    )
    
    db.add(expired_token)
    db.add(active_token)
    db.commit()
    
    # Verify all records exist in DB
    assert db.get(AuthSession, expired_sess_token) is not None
    assert db.get(AuthSession, active_sess_token) is not None
    assert db.get(RefreshToken, expired_token.jti) is not None
    assert db.get(RefreshToken, active_token.jti) is not None
    
    # Mock Session Context to yield our test DB session
    class MockSessionContext:
        def __init__(self, session: Session) -> None:
            self.session = session
        def __enter__(self) -> Session:
            return self.session
        def __exit__(self, exc_type, exc_val, exc_tb) -> None:
            pass
            
    monkeypatch.setattr(cleanup_sessions, "Session", lambda engine: MockSessionContext(db))
    
    # Run the async cleanup task
    result = asyncio.run(cleanup_expired_sessions({}))
    
    # Check return values
    assert result["deleted_sessions"] == 1
    assert result["deleted_tokens"] == 1
    
    # Verify only expired records were deleted
    assert db.get(AuthSession, expired_sess_token) is None
    assert db.get(RefreshToken, expired_token.jti) is None
    
    # Verify active records still exist
    assert db.get(AuthSession, active_sess_token) is not None
    assert db.get(RefreshToken, active_token.jti) is not None
    
    # Cleanup active records
    db.delete(active_token)
    db.commit()
    db.delete(active_session)
    db.commit()
