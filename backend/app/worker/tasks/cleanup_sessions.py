import logging
from datetime import datetime, timezone
from sqlmodel import Session, delete

from app.core.db import engine
from app.models import AuthSession, RefreshToken

logger = logging.getLogger(__name__)


async def cleanup_expired_sessions(ctx: dict) -> dict[str, int]:
    _ = ctx
    now = datetime.now(timezone.utc)
    
    deleted_sessions = 0
    deleted_tokens = 0
    
    with Session(engine) as session:
        # Delete expired RefreshTokens first to avoid foreign key constraint violations
        # (since RefreshToken has foreign_key="auth_session.token")
        stmt_tokens = delete(RefreshToken).where(RefreshToken.expires_at < now)
        result_tokens = session.execute(stmt_tokens)
        deleted_tokens = result_tokens.rowcount or 0
        
        # Delete expired AuthSessions
        stmt_sessions = delete(AuthSession).where(AuthSession.expires_at < now)
        result_sessions = session.execute(stmt_sessions)
        deleted_sessions = result_sessions.rowcount or 0
        
        session.commit()
        
    logger.info(
        "Cleaned up expired sessions background job: deleted %d sessions and %d refresh tokens",
        deleted_sessions,
        deleted_tokens,
    )
    return {"deleted_sessions": deleted_sessions, "deleted_tokens": deleted_tokens}
