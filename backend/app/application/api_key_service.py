from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    api_key_lookup_prefix,
    create_api_key,
    hash_api_key,
    verify_api_key,
)
from app.domain.exceptions import NotFoundError, ValidationError
from app.infrastructure.db import models
from app.infrastructure.db.repositories import ApiKeyRepository

API_KEY_SCOPES = [
    "accounts:read",
    "posts:read",
    "posts:write",
    "ai:generate",
]


@dataclass(frozen=True, slots=True)
class PublicApiKey:
    id: str
    name: str
    prefix: str
    scopes: list[str]
    is_active: bool
    expires_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class ApiPrincipal:
    user_id: str
    api_key_id: str
    name: str
    scopes: list[str]
    auth_method: str = "api_key"

    def has_scope(self, scope: str) -> bool:
        return "*" in self.scopes or scope in self.scopes


@dataclass(frozen=True, slots=True)
class CreatedApiKey:
    api_key: PublicApiKey
    token: str


def encode_scopes(scopes: list[str]) -> str:
    return json.dumps(sorted(set(scopes)))


def decode_scopes(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(decoded, list):
        return []
    return [str(item) for item in decoded]


def to_public_api_key(api_key: models.ApiKey) -> PublicApiKey:
    return PublicApiKey(
        id=api_key.id,
        name=api_key.name,
        prefix=api_key.prefix,
        scopes=decode_scopes(api_key.scopes),
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        created_at=api_key.created_at,
        updated_at=api_key.updated_at,
    )


class ApiKeyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.api_keys = ApiKeyRepository(session)

    async def create_api_key(
        self,
        *,
        user_id: str,
        name: str,
        scopes: list[str] | None = None,
        expires_at: datetime | None = None,
    ) -> CreatedApiKey:
        name = name.strip()
        if not name:
            raise ValidationError("API key name is required")

        requested_scopes = scopes or API_KEY_SCOPES
        if not requested_scopes:
            raise ValidationError("At least one scope is required")
        unknown_scopes = sorted(set(requested_scopes) - set(API_KEY_SCOPES) - {"*"})
        if unknown_scopes:
            raise ValidationError(f"Unknown API key scopes: {', '.join(unknown_scopes)}")

        raw_key, prefix = create_api_key()
        now = datetime.now(UTC).replace(tzinfo=None)
        api_key = await self.api_keys.add(
            models.ApiKey(
                id=uuid4().hex,
                user_id=user_id,
                name=name,
                prefix=prefix,
                key_hash=hash_api_key(raw_key),
                scopes=encode_scopes(requested_scopes),
                is_active=True,
                expires_at=expires_at,
                created_at=now,
                updated_at=now,
            )
        )
        return CreatedApiKey(api_key=to_public_api_key(api_key), token=raw_key)

    async def list_api_keys(self, user_id: str) -> list[PublicApiKey]:
        rows = await self.api_keys.list_for_user(user_id)
        return [to_public_api_key(row) for row in rows]

    async def revoke_api_key(self, user_id: str, api_key_id: str) -> None:
        api_key = await self.api_keys.get_owned(api_key_id, user_id)
        if api_key is None:
            raise NotFoundError("API key not found")
        api_key.is_active = False
        api_key.updated_at = datetime.now(UTC).replace(tzinfo=None)
        await self.api_keys.flush()

    async def authenticate(self, raw_key: str | None) -> ApiPrincipal | None:
        if not raw_key:
            return None
        prefix = api_key_lookup_prefix(raw_key)
        if prefix is None:
            return None

        api_key = await self.api_keys.get_by_prefix(prefix)
        if api_key is None:
            return None
        if not api_key.is_active:
            return None

        now = datetime.now(UTC).replace(tzinfo=None)
        if api_key.expires_at is not None and api_key.expires_at <= now:
            return None
        if not verify_api_key(raw_key, api_key.key_hash):
            return None

        api_key.last_used_at = now
        api_key.updated_at = now
        await self.api_keys.flush()
        return ApiPrincipal(
            user_id=api_key.user_id,
            api_key_id=api_key.id,
            name=api_key.name,
            scopes=decode_scopes(api_key.scopes),
        )
