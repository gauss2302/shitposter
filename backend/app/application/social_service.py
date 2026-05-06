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
from app.infrastructure.external.twitter_oauth1 import (
    exchange_twitter_oauth1_access_token,
    generate_twitter_oauth1_auth_link,
    verify_twitter_oauth1_credentials,
)
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

    async def handle_oauth2_callback(
        self,
        *,
        platform: str,
        code: str | None,
        state: str | None,
        error: str | None,
    ) -> None:
        if error:
            raise ValidationError("oauth_denied")
        if not code or not state:
            raise ValidationError("missing_params")

        redis = get_redis()
        stored = await redis.get(f"oauth:{platform}:{state}")
        if not stored:
            raise ValidationError("invalid_state")
        await redis.delete(f"oauth:{platform}:{state}")
        data = json.loads(stored)
        user_id = data["userId"]
        code_verifier = data.get("codeVerifier")

        if platform == "twitter":
            tokens, platform_user = await self._exchange_twitter_code(code, code_verifier)
        elif platform == "linkedin":
            tokens, platform_user = await self._exchange_linkedin_code(code)
        else:
            raise ValidationError(f"Unsupported platform: {platform}")

        await self.upsert_social_account(
            user_id=user_id,
            platform=platform,
            platform_user=platform_user,
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            expires_in=tokens.get("expires_in"),
        )

    async def _exchange_twitter_code(
        self, code: str, code_verifier: str | None
    ) -> tuple[dict[str, object], ConnectedPlatformUser]:
        config = self.oauth_config("twitter")
        redirect_uri = f"{self.settings.backend_public_url}{config.callback_path}"
        async with httpx.AsyncClient(timeout=30) as client:
            token_response = await client.post(
                "https://api.twitter.com/2/oauth2/token",
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code_verifier": code_verifier or "",
                },
                auth=(config.client_id, config.client_secret),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if not token_response.is_success:
                raise ValidationError("connection_failed")
            tokens = token_response.json()
            user_response = await client.get(
                "https://api.twitter.com/2/users/me?user.fields=profile_image_url",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            if not user_response.is_success:
                raise ValidationError("connection_failed")
            user = user_response.json()["data"]
        return tokens, ConnectedPlatformUser(
            platform_user_id=user["id"],
            username=user["username"],
            profile_image_url=user.get("profile_image_url"),
        )

    async def _exchange_linkedin_code(
        self, code: str
    ) -> tuple[dict[str, object], ConnectedPlatformUser]:
        config = self.oauth_config("linkedin")
        redirect_uri = f"{self.settings.backend_public_url}{config.callback_path}"
        async with httpx.AsyncClient(timeout=30) as client:
            token_response = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": config.client_id,
                    "client_secret": config.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if not token_response.is_success:
                raise ValidationError("connection_failed")
            tokens = token_response.json()
            user_response = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            if not user_response.is_success:
                raise ValidationError("connection_failed")
            user = user_response.json()
        return tokens, ConnectedPlatformUser(
            platform_user_id=user.get("sub") or user.get("id"),
            username=user.get("name") or user.get("given_name") or "LinkedIn User",
            profile_image_url=user.get("picture"),
        )

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

    async def build_twitter_oauth1_connect_url(self, user_id: str) -> str:
        if not await self.billing.can_connect_platform_account(user_id, "twitter"):
            raise ValidationError("subscription_required")
        if not self.settings.twitter_client_id or not self.settings.twitter_client_secret:
            raise ValidationError("twitter OAuth is not configured")
        callback_url = f"{self.settings.backend_public_url}/api/v1/social/callback/twitter-oauth1"
        auth_link = await generate_twitter_oauth1_auth_link(
            callback_url=callback_url,
            consumer_key=self.settings.twitter_client_id,
            consumer_secret=self.settings.twitter_client_secret,
        )
        state = secrets.token_urlsafe(24)
        await get_redis().setex(
            f"oauth1:twitter:{state}",
            600,
            json.dumps(
                {
                    "userId": user_id,
                    "oauthToken": auth_link["oauth_token"],
                    "oauthTokenSecret": auth_link["oauth_token_secret"],
                }
            ),
        )
        return auth_link["url"]

    async def handle_twitter_oauth1_callback(
        self,
        *,
        oauth_token: str | None,
        oauth_verifier: str | None,
        denied: str | None,
    ) -> None:
        if denied:
            raise ValidationError("oauth1_denied")
        if not oauth_token or not oauth_verifier:
            raise ValidationError("missing_oauth1_params")

        redis = get_redis()
        stored: dict[str, str] | None = None
        stored_key: str | None = None
        for key in await redis.keys("oauth1:twitter:*"):
            value = await redis.get(key)
            if not value:
                continue
            parsed = json.loads(value)
            if parsed.get("oauthToken") == oauth_token:
                stored = parsed
                stored_key = key
                break
        if stored is None:
            raise ValidationError("oauth1_invalid_token")
        if stored_key:
            await redis.delete(stored_key)

        token = await exchange_twitter_oauth1_access_token(
            oauth_token=oauth_token,
            oauth_token_secret=stored["oauthTokenSecret"],
            oauth_verifier=oauth_verifier,
            consumer_key=self.settings.twitter_client_id,
            consumer_secret=self.settings.twitter_client_secret,
        )
        profile = await verify_twitter_oauth1_credentials(
            access_token=token["oauth_token"],
            access_token_secret=token["oauth_token_secret"],
            consumer_key=self.settings.twitter_client_id,
            consumer_secret=self.settings.twitter_client_secret,
        )
        platform_user_id = str(profile.get("id_str") or token.get("user_id") or "")
        username = str(profile.get("screen_name") or token.get("screen_name") or "")
        if not platform_user_id or not username:
            raise ValidationError("oauth1_invalid_profile")

        user_id = stored["userId"]
        account = await self.accounts.get_by_platform_identity(
            user_id, "twitter", platform_user_id
        )
        if account is None:
            if not await self.billing.can_connect_platform_account(user_id, "twitter"):
                raise ValidationError("limit_reached")
            account = models.SocialAccount(
                id=secrets.token_urlsafe(16),
                user_id=user_id,
                platform="twitter",
                platform_user_id=platform_user_id,
                platform_username=username,
                access_token=encrypt(token["oauth_token"]),
                oauth1_access_token=encrypt(token["oauth_token"]),
                access_token_secret=encrypt(token["oauth_token_secret"]),
                is_active=True,
            )
            await self.accounts.add(account)
            return

        account.oauth1_access_token = encrypt(token["oauth_token"])
        account.access_token_secret = encrypt(token["oauth_token_secret"])
        account.platform_username = username
        account.is_active = True
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
                access_token=encrypt(access_token),
                refresh_token=encrypt(refresh_token) if refresh_token else None,
                token_expires_at=token_expires_at,
                profile_image_url=platform_user.profile_image_url,
                is_active=True,
            )
            return await self.accounts.add(existing)

        existing.access_token = encrypt(access_token)
        existing.refresh_token = encrypt(refresh_token) if refresh_token else None
        existing.token_expires_at = token_expires_at
        existing.platform_username = platform_user.username
        existing.profile_image_url = platform_user.profile_image_url
        existing.is_active = True
        await self.accounts.flush()
        return existing
