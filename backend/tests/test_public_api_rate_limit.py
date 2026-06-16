"""Sliding-window rate limiter — uses fakeredis to keep tests hermetic."""

from __future__ import annotations

import pytest

fakeredis = pytest.importorskip("fakeredis")
from fakeredis.aioredis import FakeRedis  # noqa: E402  pytest.importorskip pattern

from app.application.rate_limit import RateLimiter  # noqa: E402


async def test_acquire_below_limit_returns_allowed() -> None:
    limiter = RateLimiter(FakeRedis())

    decision = await limiter.acquire(
        bucket="read", key="key-1", limit=5, window_seconds=60
    )

    assert decision.allowed is True
    assert decision.limit == 5
    assert decision.remaining == 4


async def test_acquire_blocks_when_limit_hit_and_returns_retry_after() -> None:
    limiter = RateLimiter(FakeRedis())

    for _ in range(3):
        decision = await limiter.acquire(
            bucket="write", key="key-1", limit=3, window_seconds=60
        )
        assert decision.allowed is True

    blocked = await limiter.acquire(
        bucket="write", key="key-1", limit=3, window_seconds=60
    )

    assert blocked.allowed is False
    assert blocked.remaining == 0
    assert blocked.retry_after_seconds >= 1


async def test_buckets_are_independent_per_key() -> None:
    limiter = RateLimiter(FakeRedis())

    a = await limiter.acquire(bucket="read", key="key-a", limit=1, window_seconds=60)
    b = await limiter.acquire(bucket="read", key="key-b", limit=1, window_seconds=60)

    assert a.allowed is True
    assert b.allowed is True


async def test_zero_limit_short_circuits_to_blocked() -> None:
    limiter = RateLimiter(FakeRedis())

    decision = await limiter.acquire(
        bucket="read", key="key-1", limit=0, window_seconds=60
    )

    assert decision.allowed is False
    assert decision.retry_after_seconds == 60
