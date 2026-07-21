import os
from slowapi import Limiter
from fastapi import Request
from app.core.config import settings

def get_real_client_ip(request: Request) -> str:
    # Check X-Forwarded-For header to handle reverse proxies (Traefik, Nginx, etc.)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
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
