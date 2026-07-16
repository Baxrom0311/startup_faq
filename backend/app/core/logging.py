"""Structured logging configuration for the application.

In production (non-local) environments, logs are output as JSON for easy
parsing by log aggregation systems.  Locally, the default human-readable
format is preserved.
"""

import logging
import sys

from app.core.config import settings


def setup_logging() -> None:
    """Configure the root logger based on the current environment."""
    level = logging.DEBUG if settings.ENVIRONMENT == "local" else logging.INFO
    root = logging.getLogger()
    root.setLevel(level)

    # Remove existing handlers to avoid duplicate output.
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    if settings.ENVIRONMENT == "local":
        fmt = "%(asctime)s %(levelname)-8s %(name)s  %(message)s"
        handler.setFormatter(logging.Formatter(fmt))
    else:
        # Simple JSON-like structured format for production log aggregation.
        fmt = (
            '{"time":"%(asctime)s","level":"%(levelname)s",'
            '"logger":"%(name)s","message":"%(message)s"}'
        )
        handler.setFormatter(logging.Formatter(fmt))

    root.addHandler(handler)

    # Reduce noise from noisy libraries.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("aiogram").setLevel(logging.WARNING)
