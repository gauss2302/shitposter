"""Shared FastAPI dependency providers."""

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.api_key_service import ApiKeyService
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

api_key_header = APIKeyHeader(
    name="X-API-Key",
    scheme_name="AgentApiKey",
    description="Agent API key. Prefer Authorization: Bearer <key> when possible.",
    auto_error=False,
)
bearer_header = HTTPBearer(
    scheme_name="AgentBearer",
    description="Agent API key passed as a Bearer token.",
    auto_error=False,
)


@dataclass(frozen=True, slots=True)
class ApiPrincipal:
    user_id: str
    api_key_id: str
    api_key_name: str
    scopes: frozenset[str]

    def has_scope(self, scope: str) -> bool:
        return "*" in self.scopes or scope in self.scopes


async def get_current_user(
    request: Request,
    db: DbSessionDep,
    settings: SettingsDep,
) -> AuthenticatedUser:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    authenticated = await AuthService(db, settings).get_user_for_session(token)
    if authenticated is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return authenticated


async def get_current_api_principal(
    db: DbSessionDep,
    header_key: Annotated[str | None, Security(api_key_header)] = None,
    bearer: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_header)] = None,
) -> ApiPrincipal:
    raw_key = bearer.credentials if bearer is not None else header_key
    authenticated = await ApiKeyService(db).authenticate(raw_key)
    if authenticated is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    await db.commit()
    return ApiPrincipal(
        user_id=authenticated.user_id,
        api_key_id=authenticated.api_key_id,
        api_key_name=authenticated.name,
        scopes=frozenset(authenticated.scopes),
    )


def require_api_scope(scope: str):
    async def dependency(
        principal: Annotated[ApiPrincipal, Depends(get_current_api_principal)],
    ) -> ApiPrincipal:
        if not principal.has_scope(scope):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient scope")
        return principal

    return dependency
