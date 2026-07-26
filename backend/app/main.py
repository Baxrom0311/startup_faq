import logging

import sentry_sdk
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import DataError, IntegrityError, SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import setup_logging

# Configure structured logging before anything else.
setup_logging()

logger = logging.getLogger(__name__)


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(IntegrityError)
async def _integrity_error_handler(request: Request, _exc: IntegrityError) -> JSONResponse:
    # A unique/foreign-key violation is a client conflict, not a server bug.
    logger.warning("IntegrityError on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Resource conflict"},
    )


@app.exception_handler(DataError)
async def _data_error_handler(request: Request, _exc: DataError) -> JSONResponse:
    # e.g. value too long / bad type — bad input, not a server error.
    logger.warning("DataError on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Invalid input"},
    )


@app.exception_handler(SQLAlchemyError)
async def _sqlalchemy_error_handler(request: Request, _exc: SQLAlchemyError) -> JSONResponse:
    # Any other DB error: log the detail server-side, never leak it to the client.
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add baseline security response headers."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if settings.ENVIRONMENT != "local":
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Restrict CORS to the configured frontend origins. The app authenticates with
# Bearer tokens (not cookies), so credentials stay disabled.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
