from __future__ import annotations

from arq.connections import RedisSettings
from arq.cron import cron

from app.core.config import get_settings
from app.worker.jobs import poll_video_job, publish_post, recipe_scheduler, run_recipe


class WorkerSettings:
    functions = [publish_post, poll_video_job, run_recipe]
    cron_jobs = [
        # Fires every minute. The scheduler queries ``video_recipe`` for due
        # rows and enqueues ``run_recipe`` jobs for each.
        cron(recipe_scheduler, minute=set(range(60))),
    ]
    redis_settings = RedisSettings.from_dsn(str(get_settings().redis_url))
    max_jobs = 3
    job_timeout = 300
    keep_result = 86_400
