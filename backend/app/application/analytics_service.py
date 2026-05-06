from __future__ import annotations

import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import AuthenticationError, NotFoundError, RateLimitError
from app.infrastructure.crypto import decrypt
from app.infrastructure.db.repositories import SocialAccountRepository
from app.infrastructure.external.twitter import TwitterRateLimitError, get_twitter_analytics
from app.infrastructure.redis import get_redis


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.social_accounts = SocialAccountRepository(session)

    async def twitter_analytics(self, *, user_id: str, account_id: str, limit: int) -> dict:
        account = await self.social_accounts.get_owned(account_id, user_id)
        if account is None or account.platform != "twitter":
            raise NotFoundError("Twitter account not found")
        if not account.is_active:
            raise AuthenticationError("Twitter account is not active. Please reconnect.")

        tweet_limit = min(max(limit, 1), 100)
        cache_key = f"twitter:analytics:{account_id}:{tweet_limit}"
        redis = get_redis()
        try:
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            cached = None

        access_token = decrypt(account.access_token)
        try:
            analytics = await get_twitter_analytics(access_token, tweet_limit)
        except TwitterRateLimitError as exc:
            raise RateLimitError(exc.message) from exc

        try:
            await redis.setex(cache_key, 300, json.dumps(analytics))
        except Exception:
            pass
        return analytics

    async def get_twitter_analytics(
        self, *, user_id: str, account_id: str, tweet_limit: int
    ) -> dict:
        return await self.twitter_analytics(
            user_id=user_id,
            account_id=account_id,
            limit=tweet_limit,
        )


__all__ = ["AnalyticsService", "TwitterRateLimitError"]
