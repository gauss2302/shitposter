from __future__ import annotations

from redis.asyncio import Redis

from app.core.config import get_settings

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = Redis.from_url(str(settings.redis_url), decode_responses=True)
    return _redis


async def redis_health_check() -> bool:
    try:
        redis = get_redis()
        pong = await redis.ping()
        return bool(pong)
    except Exception:
        return False


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
