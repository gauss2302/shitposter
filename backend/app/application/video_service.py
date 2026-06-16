"""Video generation service.

Submits async video jobs to providers (currently Replicate, which is itself
a gateway covering Kling / Pika / Luma / Hunyuan / etc.) and tracks them
in ``video_generation_job``. The actual polling + asset mirroring to R2
is done by ``worker.jobs.poll_video_job`` so the API request stays fast.

Per-user provider credentials will land in a follow-up; for now we use the
backend's environment-level ``REPLICATE_API_TOKEN``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.domain.enums import VideoJobStatus, VideoProvider
from app.domain.exceptions import NotFoundError, ValidationError
from app.infrastructure.db import models
from app.infrastructure.db.repositories import VideoGenerationJobRepository
from app.infrastructure.queue import enqueue_poll_video_job


@dataclass(frozen=True, slots=True)
class PublicVideoJob:
    id: str
    provider: str
    model: str
    prompt: str
    status: str
    output_url: str | None
    provider_job_id: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


def to_public_job(row: models.VideoGenerationJob) -> PublicVideoJob:
    return PublicVideoJob(
        id=row.id,
        provider=row.provider,
        model=row.model,
        prompt=row.prompt,
        status=row.status,
        output_url=row.output_url,
        provider_job_id=row.provider_job_id,
        error_message=row.error_message,
        created_at=row.created_at,
        updated_at=row.updated_at,
        started_at=row.started_at,
        completed_at=row.completed_at,
    )


class VideoService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.jobs = VideoGenerationJobRepository(session)

    async def submit(
        self,
        *,
        user_id: str,
        provider: str,
        model: str,
        prompt: str,
        params: dict[str, Any] | None = None,
    ) -> PublicVideoJob:
        if not prompt.strip():
            raise ValidationError("Prompt is required")
        if not model.strip():
            raise ValidationError("Model is required")
        try:
            VideoProvider(provider)
        except ValueError as exc:
            raise ValidationError(f"Unsupported video provider: {provider}") from exc
        if provider == VideoProvider.REPLICATE.value and not self.settings.replicate_api_token:
            raise ValidationError("Replicate API token is not configured")
        if provider in (VideoProvider.RUNWAY.value, VideoProvider.FALAI.value):
            raise ValidationError(f"{provider} adapter is not yet implemented")

        now = datetime.now(UTC).replace(tzinfo=None)
        row = await self.jobs.add(
            models.VideoGenerationJob(
                id=uuid4().hex,
                user_id=user_id,
                provider=provider,
                model=model,
                prompt=prompt,
                params_json=json.dumps(params or {}),
                status=VideoJobStatus.QUEUED.value,
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.commit()
        # Worker handles the actual provider call: this keeps the API request
        # fast and lets us absorb provider rate limits inside ARQ.
        await enqueue_poll_video_job({"job_id": row.id})
        return to_public_job(row)

    async def get(self, *, user_id: str, job_id: str) -> PublicVideoJob:
        row = await self.jobs.get_owned(job_id, user_id)
        if row is None:
            raise NotFoundError("Video job not found")
        return to_public_job(row)

    async def list_jobs(self, *, user_id: str) -> list[PublicVideoJob]:
        rows = await self.jobs.list_for_user(user_id)
        return [to_public_job(row) for row in rows]
