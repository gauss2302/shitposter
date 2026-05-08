from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.api_key_service import decode_scopes
from app.application.posts_service import SUPPORTED_PUBLISHING_PLATFORMS
from app.core.config import Settings
from app.infrastructure.db import models
from app.infrastructure.db.repositories import AiCredentialRepository, ApiKeyRepository, SocialAccountRepository

AGENT_AUTOMATION_SCOPES = frozenset(
    {
        "accounts:read",
        "posts:write",
        "ai:generate",
    }
)
AGENT_PROVIDER_API_SCOPES = frozenset(
    {
        "ai:providers:read",
        "ai:providers:write",
    }
)


def _scopes_cover_requirement(scopes: list[str], required: frozenset[str]) -> bool:
    effective = set(scopes)
    if "*" in effective:
        return True
    return required.issubset(effective)


def _api_key_is_usable(key: models.ApiKey, now: datetime) -> bool:
    if not key.is_active:
        return False
    expires_at = key.expires_at
    if expires_at is not None and expires_at <= now:
        return False
    return True


@dataclass(frozen=True, slots=True)
class AgentReadinessResult:
    ready_to_automate: bool
    has_postable_social_account: bool
    postable_social_account_count: int
    has_ai_configuration: bool
    ai_configuration_source: str
    has_operational_api_key: bool
    operational_api_key_count: int
    can_manage_ai_providers_via_api: bool
    provider_api_key_count: int


class AgentReadinessService:
    """Summarizes whether a user can run the model → generate → post agent flow."""

    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.social_accounts = SocialAccountRepository(session)
        self.api_keys = ApiKeyRepository(session)
        self.ai_credentials = AiCredentialRepository(session)

    def _server_ai_configured(self) -> bool:
        if self.settings.openai_api_key.strip():
            return True
        if self.settings.anthropic_api_key.strip():
            return True
        if self.settings.openai_compatible_api_key.strip() and (
            self.settings.openai_compatible_base_url or ""
        ).strip():
            return True
        return False

    async def evaluate(self, user_id: str) -> AgentReadinessResult:
        now = datetime.now(UTC).replace(tzinfo=None)

        accounts = await self.social_accounts.list_for_user(user_id)
        postable = [
            account
            for account in accounts
            if account.is_active and account.platform in SUPPORTED_PUBLISHING_PLATFORMS
        ]
        has_postable = len(postable) > 0

        ai_rows = await self.ai_credentials.list_for_user(user_id)
        user_ai = any(row.is_active for row in ai_rows)
        server_ai = self._server_ai_configured()
        has_ai = user_ai or server_ai
        if user_ai:
            ai_source = "user_models"
        elif server_ai:
            ai_source = "server_defaults"
        else:
            ai_source = "none"

        keys = await self.api_keys.list_for_user(user_id)
        operational = 0
        provider_api = 0
        for key in keys:
            if not _api_key_is_usable(key, now):
                continue
            scopes = decode_scopes(key.scopes)
            if _scopes_cover_requirement(scopes, AGENT_AUTOMATION_SCOPES):
                operational += 1
            if _scopes_cover_requirement(scopes, AGENT_PROVIDER_API_SCOPES):
                provider_api += 1

        has_operational = operational > 0
        can_manage_providers = provider_api > 0

        ready = has_postable and has_ai and has_operational

        return AgentReadinessResult(
            ready_to_automate=ready,
            has_postable_social_account=has_postable,
            postable_social_account_count=len(postable),
            has_ai_configuration=has_ai,
            ai_configuration_source=ai_source,
            has_operational_api_key=has_operational,
            operational_api_key_count=operational,
            can_manage_ai_providers_via_api=can_manage_providers,
            provider_api_key_count=provider_api,
        )
