"""Shared FastAPI dependency providers."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth_service import AuthenticatedUser, AuthService
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


DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


async def get_current_user(
    request: Request,
    db: DbSessionDep,
    settings: SettingsDep,
) -> AuthenticatedUser:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    authenticated = await AuthService(db, settings).get_authenticated_user(token)
    if authenticated is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return authenticated
