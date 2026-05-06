from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import get_settings


@lru_cache
def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(str(get_settings().redis_url))


async def get_queue_pool() -> ArqRedis:
    return await create_pool(redis_settings())


async def enqueue_publish_job(
    payload: dict[str, Any],
    *,
    scheduled_for: datetime | None,
) -> None:
    """Enqueue a post publishing job for the Python worker.

    The legacy TypeScript worker used a small delay for immediate jobs so the
    database transaction was visible to workers. Preserve that behavior.
    """

    pool = await get_queue_pool()
    try:
        if scheduled_for and scheduled_for > datetime.now():
            await pool.enqueue_job("publish_post", payload, _defer_until=scheduled_for)
        else:
            await pool.enqueue_job("publish_post", payload, _defer_by=1)
    finally:
        await pool.aclose()
