from __future__ import annotations

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.worker.jobs import publish_post


class WorkerSettings:
    functions = [publish_post]
    redis_settings = RedisSettings.from_dsn(str(get_settings().redis_url))
    max_jobs = 3
    job_timeout = 300
    keep_result = 86_400
