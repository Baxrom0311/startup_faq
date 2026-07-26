import os
from slowapi import Limiter
from fastapi import Request
from app.core.config import settings

def get_real_client_ip(request: Request) -> str:
    # X-Forwarded-For is "client, proxy1, proxy2, ...". The LEFTMOST value is
    # attacker-controlled (a client can send any XFF), so keying rate limits on
    # it lets an attacker present a fresh IP per request and bypass the limit.
    # Trust only the entry appended by our own reverse proxy: the Nth from the
    # right, where N = number of trusted proxies in front of the app.
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            idx = min(settings.TRUSTED_PROXY_COUNT, len(parts))
            return parts[-idx]
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"

import sys

# Setup storage URI (memory storage for tests, Redis for production/local)
storage_uri = settings.REDIS_URL
if (
    os.getenv("TESTING") == "True"
    or "pytest" in sys.modules
    or os.getenv("PYTEST_CURRENT_TEST") is not None
):
    storage_uri = "memory://"

limiter = Limiter(
    key_func=get_real_client_ip,
    storage_uri=storage_uri,
)
