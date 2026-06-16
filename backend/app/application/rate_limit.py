"""Per-key sliding-window rate limiter on top of ``redis.asyncio``.

Avoids a new dependency: the project already uses the async Redis client
for queue + caching, so we stay consistent. The implementation stores
timestamps in a sorted set, trims everything older than ``window``,
counts what's left, and adds the new request — atomically via a pipeline.

The limiter is *advisory* (no Lua script): under heavy contention two
requests may both observe ``count < limit`` in the same millisecond and
slip through. That's fine for an API quota — exact accounting isn't
worth the complexity here.
"""

from __future__ import annotations

import itertools
import time
from dataclasses import dataclass
from typing import Protocol

_sequence = itertools.count()


class _RedisLike(Protocol):
    def pipeline(self, transaction: bool = ...) -> object: ...


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    allowed: bool
    remaining: int
    limit: int
    retry_after_seconds: int
    reset_at_epoch: int


class RateLimiter:
    """Sliding-window limiter against a Redis sorted-set per bucket+key."""

    def __init__(self, redis: _RedisLike) -> None:
        self._redis = redis

    async def acquire(
        self,
        *,
        bucket: str,
        key: str,
        limit: int,
        window_seconds: int,
    ) -> RateLimitDecision:
        if limit <= 0:
            # A zero quota means the principal is gated off entirely.
            return RateLimitDecision(
                allowed=False,
                remaining=0,
                limit=0,
                retry_after_seconds=window_seconds,
                reset_at_epoch=int(time.time()) + window_seconds,
            )
        now = time.time()
        now_ms = int(now * 1000)
        cutoff_ms = now_ms - window_seconds * 1000
        redis_key = f"ratelimit:{bucket}:{key}"
        # Sorted-set members must be unique. Two calls in the same
        # millisecond would collide on (now_ms, now_ms), so disambiguate
        # with a process-local counter.
        member = f"{now_ms}:{next(_sequence)}"

        pipe = self._redis.pipeline(transaction=False)
        pipe.zremrangebyscore(redis_key, 0, cutoff_ms)
        pipe.zadd(redis_key, {member: now_ms})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, window_seconds)
        results = await pipe.execute()
        count = int(results[2])

        if count > limit:
            # Roll back this attempt so it doesn't count against future ones.
            await self._redis.zrem(redis_key, member)
            # Retry-after is the age of the oldest entry that, once it
            # expires, lets us slip back under the limit.
            oldest = await self._redis.zrange(redis_key, 0, 0, withscores=True)
            if oldest:
                oldest_ms = int(oldest[0][1])
                retry_after = max(1, window_seconds - int((now_ms - oldest_ms) / 1000))
            else:
                retry_after = window_seconds
            return RateLimitDecision(
                allowed=False,
                remaining=0,
                limit=limit,
                retry_after_seconds=retry_after,
                reset_at_epoch=int(now) + retry_after,
            )

        return RateLimitDecision(
            allowed=True,
            remaining=max(0, limit - count),
            limit=limit,
            retry_after_seconds=0,
            reset_at_epoch=int(now) + window_seconds,
        )
