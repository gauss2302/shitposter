from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.domain.exceptions import NotFoundError, ValidationError
from app.infrastructure.crypto import decrypt, encrypt
from app.infrastructure.db import models
from app.infrastructure.db.repositories import AiCredentialRepository, SocialAccountRepository
from app.infrastructure.external.ai_anthropic import generate_anthropic_content
from app.infrastructure.external.ai_openai import generate_openai_content

AI_PROVIDERS = ["openai", "anthropic", "openai_compatible"]
PLATFORM_LIMITS = {
    "twitter": 280,
    "threads": 500,
    "instagram": 2200,
    "tiktok": 2200,
    "linkedin": 3000,
    "facebook": 63206,
}


@dataclass(frozen=True, slots=True)
class PublicAiCredential:
    id: str
    provider: str
    display_name: str
    base_url: str | None
    default_model: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class AiGenerationCandidate:
    content: str
    platform_fit: dict[str, bool]
    char_count: int
    warnings: list[str]


@dataclass(frozen=True, slots=True)
class AiGenerationResult:
    provider: str
    model: str
    candidates: list[AiGenerationCandidate]


def to_public_credential(row: models.AiProviderCredential) -> PublicAiCredential:
    return PublicAiCredential(
        id=row.id,
        provider=row.provider,
        display_name=row.display_name,
        base_url=row.base_url,
        default_model=row.default_model,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class AiService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.credentials = AiCredentialRepository(session)
        self.accounts = SocialAccountRepository(session)

    async def list_credentials(self, user_id: str) -> list[PublicAiCredential]:
        rows = await self.credentials.list_for_user(user_id)
        return [to_public_credential(row) for row in rows]

    async def create_credential(
        self,
        *,
        user_id: str,
        provider: str,
        display_name: str,
        api_key: str,
        default_model: str,
        base_url: str | None = None,
    ) -> PublicAiCredential:
        self._validate_provider(provider)
        if not api_key.strip():
            raise ValidationError("AI provider API key is required")
        if not default_model.strip():
            raise ValidationError("Default model is required")
        now = datetime.now(UTC).replace(tzinfo=None)
        row = await self.credentials.add(
            models.AiProviderCredential(
                id=uuid4().hex,
                user_id=user_id,
                provider=provider,
                display_name=display_name.strip() or provider,
                encrypted_api_key=encrypt(api_key),
                base_url=base_url.strip() if base_url else None,
                default_model=default_model.strip(),
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )
        return to_public_credential(row)

    async def update_credential(
        self,
        *,
        user_id: str,
        credential_id: str,
        display_name: str | None = None,
        api_key: str | None = None,
        default_model: str | None = None,
        base_url: str | None = None,
        is_active: bool | None = None,
    ) -> PublicAiCredential:
        row = await self.credentials.get_owned(credential_id, user_id)
        if row is None:
            raise NotFoundError("AI provider credential not found")
        if display_name is not None:
            row.display_name = display_name.strip() or row.provider
        if api_key is not None and api_key.strip():
            row.encrypted_api_key = encrypt(api_key)
        if default_model is not None and default_model.strip():
            row.default_model = default_model.strip()
        if base_url is not None:
            row.base_url = base_url.strip() or None
        if is_active is not None:
            row.is_active = is_active
        row.updated_at = datetime.now(UTC).replace(tzinfo=None)
        await self.credentials.flush()
        return to_public_credential(row)

    async def delete_credential(self, *, user_id: str, credential_id: str) -> None:
        row = await self.credentials.get_owned(credential_id, user_id)
        if row is None:
            raise NotFoundError("AI provider credential not found")
        await self.credentials.delete(row)

    async def generate(
        self,
        *,
        user_id: str,
        prompt: str,
        provider_credential_id: str | None = None,
        provider: str | None = None,
        model: str | None = None,
        platforms: list[str] | None = None,
        social_account_ids: list[str] | None = None,
        language: str = "English",
        tone: str = "clear, useful, and engaging",
        max_candidates: int = 1,
        context: str | None = None,
    ) -> AiGenerationResult:
        if not prompt.strip():
            raise ValidationError("Prompt is required")
        max_candidates = min(max(max_candidates, 1), 5)
        target_platforms = await self._target_platforms(
            user_id=user_id,
            platforms=platforms or [],
            social_account_ids=social_account_ids or [],
        )
        provider_name, resolved_model, api_key, base_url = await self._resolve_provider(
            user_id=user_id,
            provider_credential_id=provider_credential_id,
            provider=provider,
            model=model,
        )
        generation_prompt = self._build_prompt(
            prompt=prompt,
            platforms=target_platforms,
            language=language,
            tone=tone,
            max_candidates=max_candidates,
            context=context,
        )
        text = await self._call_provider(
            provider=provider_name,
            api_key=api_key,
            model=resolved_model,
            prompt=generation_prompt,
            base_url=base_url,
        )
        raw_candidates = self._split_candidates(text, max_candidates)
        candidates = [
            self._candidate(content, target_platforms) for content in raw_candidates
        ]
        return AiGenerationResult(
            provider=provider_name,
            model=resolved_model,
            candidates=candidates,
        )

    async def _target_platforms(
        self,
        *,
        user_id: str,
        platforms: list[str],
        social_account_ids: list[str],
    ) -> list[str]:
        result = [platform.strip().lower() for platform in platforms if platform.strip()]
        if social_account_ids:
            accounts = await self.accounts.list_owned_by_ids(user_id, social_account_ids)
            if len(accounts) != len(set(social_account_ids)):
                raise NotFoundError("One or more accounts not found or not owned by you")
            result.extend(account.platform for account in accounts)
        return sorted(set(result)) or ["twitter"]

    async def _resolve_provider(
        self,
        *,
        user_id: str,
        provider_credential_id: str | None,
        provider: str | None,
        model: str | None,
    ) -> tuple[str, str, str, str | None]:
        if provider_credential_id:
            row = await self.credentials.get_owned(provider_credential_id, user_id)
            if row is None or not row.is_active:
                raise NotFoundError("AI provider credential not found")
            return (
                row.provider,
                model or row.default_model,
                decrypt(row.encrypted_api_key),
                row.base_url,
            )

        provider_name = provider or self._default_provider()
        self._validate_provider(provider_name)
        if provider_name == "openai":
            api_key = self.settings.openai_api_key
            resolved_model = model or self.settings.openai_default_model
            base_url = None
        elif provider_name == "anthropic":
            api_key = self.settings.anthropic_api_key
            resolved_model = model or self.settings.anthropic_default_model
            base_url = None
        else:
            api_key = self.settings.openai_compatible_api_key
            resolved_model = model or self.settings.openai_compatible_default_model
            base_url = self.settings.openai_compatible_base_url or None

        if not api_key:
            raise ValidationError(f"{provider_name} AI provider is not configured")
        if not resolved_model:
            raise ValidationError(f"{provider_name} AI model is not configured")
        return provider_name, resolved_model, api_key, base_url

    def _default_provider(self) -> str:
        if self.settings.openai_api_key:
            return "openai"
        if self.settings.anthropic_api_key:
            return "anthropic"
        if self.settings.openai_compatible_api_key:
            return "openai_compatible"
        return "openai"

    def _validate_provider(self, provider: str) -> None:
        if provider not in AI_PROVIDERS:
            raise ValidationError(f"Unsupported AI provider: {provider}")

    def _build_prompt(
        self,
        *,
        prompt: str,
        platforms: list[str],
        language: str,
        tone: str,
        max_candidates: int,
        context: str | None,
    ) -> str:
        limits = ", ".join(
            f"{platform}: {PLATFORM_LIMITS.get(platform, 'unknown')} characters"
            for platform in platforms
        )
        context_line = f"\nContext: {context}" if context else ""
        return (
            "Write social media post copy for the requested platforms.\n"
            f"Language: {language}.\n"
            f"Tone: {tone}.\n"
            f"Platforms: {', '.join(platforms)}.\n"
            f"Character limits: {limits}.\n"
            f"Return {max_candidates} candidate(s), separated by a line containing only ---."
            f"{context_line}\n\nUser request: {prompt}"
        )

    async def _call_provider(
        self,
        *,
        provider: str,
        api_key: str,
        model: str,
        prompt: str,
        base_url: str | None,
    ) -> str:
        if provider in {"openai", "openai_compatible"}:
            return await generate_openai_content(
                api_key=api_key,
                model=model,
                prompt=prompt,
                base_url=base_url,
            )
        return await generate_anthropic_content(
            api_key=api_key,
            model=model,
            prompt=prompt,
        )

    def _split_candidates(self, text: str, max_candidates: int) -> list[str]:
        parts = [part.strip() for part in text.split("---") if part.strip()]
        if not parts:
            parts = [text.strip()]
        return parts[:max_candidates]

    def _candidate(self, content: str, platforms: list[str]) -> AiGenerationCandidate:
        char_count = len(content)
        platform_fit: dict[str, bool] = {}
        warnings: list[str] = []
        for platform in platforms:
            limit = PLATFORM_LIMITS.get(platform)
            fits = limit is None or char_count <= limit
            platform_fit[platform] = fits
            if limit is not None and not fits:
                warnings.append(
                    f"Content is {char_count - limit} characters over the {platform} limit."
                )
        return AiGenerationCandidate(
            content=content,
            platform_fit=platform_fit,
            char_count=char_count,
            warnings=warnings,
        )
