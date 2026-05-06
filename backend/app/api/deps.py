"""Shared FastAPI dependency providers."""

from app.core.config import Settings
from app.core.config import get_settings as load_settings


def get_settings() -> Settings:
    """Expose cached settings as an override-friendly FastAPI dependency."""
    return load_settings()
