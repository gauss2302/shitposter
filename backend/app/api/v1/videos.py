from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SettingsDep, get_current_user, get_db_session
from app.application.auth_service import AuthenticatedUser
from app.application.video_service import PublicVideoJob, VideoService
from app.domain.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/videos", tags=["videos"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


class GenerateRequest(BaseModel):
    provider: str = "replicate"
    model: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    params: dict[str, object] | None = None


class VideoJobResponse(BaseModel):
    id: str
    provider: str
    model: str
    prompt: str
    status: str
    outputUrl: str | None
    providerJobId: str | None
    errorMessage: str | None
    createdAt: str
    updatedAt: str
    startedAt: str | None
    completedAt: str | None

    @classmethod
    def from_domain(cls, job: PublicVideoJob) -> VideoJobResponse:
        return cls(
            id=job.id,
            provider=job.provider,
            model=job.model,
            prompt=job.prompt,
            status=job.status,
            outputUrl=job.output_url,
            providerJobId=job.provider_job_id,
            errorMessage=job.error_message,
            createdAt=job.created_at.isoformat(),
            updatedAt=job.updated_at.isoformat(),
            startedAt=job.started_at.isoformat() if job.started_at else None,
            completedAt=job.completed_at.isoformat() if job.completed_at else None,
        )


class VideoJobListResponse(BaseModel):
    jobs: list[VideoJobResponse]


@router.post(
    "/generate",
    response_model=VideoJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_video_generation(
    payload: GenerateRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> VideoJobResponse:
    try:
        job = await VideoService(db, settings).submit(
            user_id=current.id,
            provider=payload.provider,
            model=payload.model,
            prompt=payload.prompt,
            params=dict(payload.params) if payload.params else None,
        )
    except ValidationError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    return VideoJobResponse.from_domain(job)


@router.get("/jobs", response_model=VideoJobListResponse)
async def list_video_jobs(
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> VideoJobListResponse:
    jobs = await VideoService(db, settings).list_jobs(user_id=current.id)
    return VideoJobListResponse(jobs=[VideoJobResponse.from_domain(j) for j in jobs])


@router.get("/jobs/{job_id}", response_model=VideoJobResponse)
async def get_video_job(
    job_id: str,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> VideoJobResponse:
    try:
        job = await VideoService(db, settings).get(user_id=current.id, job_id=job_id)
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return VideoJobResponse.from_domain(job)
