"""Shared FastAPI dependency providers."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.config import get_settings as load_settings
from app.infrastructure.db.session import async_session_factory


def get_settings() -> Settings:
    """Expose cached settings as an override-friendly FastAPI dependency."""
    return load_settings()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a request-scoped SQLAlchemy session."""
    async with async_session_factory() as session:
        yield session
