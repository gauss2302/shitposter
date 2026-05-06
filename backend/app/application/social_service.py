from __future__ import annotations

import json
import secrets
from dataclasses import dataclass

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.billing_service import BillingService
from app.core.config import Settings
from app.domain.exceptions import NotFoundError, ValidationError
from app.infrastructure.crypto import encrypt
from app.infrastructure.db import models
from app.infrastructure.db.repositories import SocialAccountRepository
from app.infrastructure.redis import get_redis


@dataclass(frozen=True)
class OAuthConfig:
    auth_url: str
    client_id: str
    client_secret: str
    scopes: list[str]
    callback_path: str


@dataclass(frozen=True)
class ConnectedPlatformUser:
    platform_user_id: str
    username: str
    profile_image_url: str | None = None


class SocialService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.accounts = SocialAccountRepository(session)
        self.billing = BillingService(session)

    def oauth_config(self, platform: str) -> OAuthConfig:
        configs = {
            "twitter": OAuthConfig(
                auth_url="https://twitter.com/i/oauth2/authorize",
                client_id=self.settings.twitter_client_id,
                client_secret=self.settings.twitter_client_secret,
                scopes=[
                    "tweet.read",
                    "tweet.write",
                    "users.read",
                    "offline.access",
                    "tweet.moderate.write",
                    "follows.read",
                    "follows.write",
                ],
                callback_path="/api/v1/social/callback/twitter",
            ),
            "linkedin": OAuthConfig(
                auth_url="https://www.linkedin.com/oauth/v2/authorization",
                client_id=self.settings.linkedin_client_id,
                client_secret=self.settings.linkedin_client_secret,
                scopes=["openid", "profile", "w_member_social", "email"],
                callback_path="/api/v1/social/callback/linkedin",
            ),
        }
        try:
            return configs[platform]
        except KeyError as exc:
            raise ValidationError(f"Unknown platform: {platform}") from exc

    async def build_connect_url(self, user_id: str, platform: str) -> str:
        if not await self.billing.can_connect_platform_account(user_id, platform):
            raise ValidationError("subscription_required")
        config = self.oauth_config(platform)
        if not config.client_id:
            raise ValidationError(f"{platform} OAuth is not configured")

        state = secrets.token_urlsafe(24)
        code_verifier = secrets.token_urlsafe(48)
        redis = get_redis()
        await redis.setex(
            f"oauth:{platform}:{state}",
            600,
            json.dumps({"userId": user_id, "codeVerifier": code_verifier}),
        )

        redirect_uri = f"{self.settings.backend_public_url}{config.callback_path}"
        params = {
            "client_id": config.client_id,
            "redirect_uri": redirect_uri,
            "scope": " ".join(config.scopes),
            "state": state,
            "response_type": "code",
        }
        if platform == "twitter":
            import base64
            import hashlib

            digest = hashlib.sha256(code_verifier.encode()).digest()
            challenge = base64.urlsafe_b64encode(digest).decode().rstrip("=")
            params["code_challenge"] = challenge
            params["code_challenge_method"] = "S256"

        return str(httpx.URL(config.auth_url, params=params))

    async def disconnect_account(self, user_id: str, account_id: str) -> None:
        account = await self.accounts.get_owned(account_id, user_id)
        if account is None:
            raise NotFoundError("Account not found")
        await self.accounts.delete(account)

    async def update_account(
        self,
        user_id: str,
        account_id: str,
        *,
        is_active: bool | None,
    ) -> None:
        account = await self.accounts.get_owned(account_id, user_id)
        if account is None:
            raise NotFoundError("Account not found")
        if is_active is not None:
            account.is_active = is_active
        await self.accounts.flush()

    async def upsert_social_account(
        self,
        *,
        user_id: str,
        platform: str,
        platform_user: ConnectedPlatformUser,
        access_token: str,
        refresh_token: str | None,
        expires_in: int | None,
    ) -> models.SocialAccount:
        from datetime import datetime, timedelta

        existing = await self.accounts.get_by_platform_identity(
            user_id, platform, platform_user.platform_user_id
        )
        token_expires_at = (
            datetime.utcnow() + timedelta(seconds=expires_in) if expires_in else None
        )
        if existing is None:
            if not await self.billing.can_connect_platform_account(user_id, platform):
                raise ValidationError("limit_reached")
            existing = models.SocialAccount(
                id=secrets.token_urlsafe(16),
                user_id=user_id,
                platform=platform,
                platform_user_id=platform_user.platform_user_id,
                platform_username=platform_user.username,
                access_token=encrypt(access_token, self.settings.token_encryption_key),
                refresh_token=(
                    encrypt(refresh_token, self.settings.token_encryption_key)
                    if refresh_token
                    else None
                ),
                token_expires_at=token_expires_at,
                profile_image_url=platform_user.profile_image_url,
                is_active=True,
            )
            return await self.accounts.add(existing)

        existing.access_token = encrypt(access_token, self.settings.token_encryption_key)
        existing.refresh_token = (
            encrypt(refresh_token, self.settings.token_encryption_key)
            if refresh_token
            else None
        )
        existing.token_expires_at = token_expires_at
        existing.platform_username = platform_user.username
        existing.profile_image_url = platform_user.profile_image_url
        existing.is_active = True
        await self.accounts.flush()
        return existing
