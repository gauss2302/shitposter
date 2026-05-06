from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel

from app.api.deps import get_settings
from app.core.config import Settings

router = APIRouter(prefix="/health", tags=["health"])
SettingsDep = Annotated[Settings, Depends(get_settings)]


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    service: str
    deep: bool = False
    database: str | None = None
    redis: str | None = None


@router.get("", response_model=HealthResponse)
async def health(
    response: Response,
    deep: bool = Query(default=False),
    settings: SettingsDep = None,
) -> HealthResponse:
    """Return lightweight or deep health.

    Deep dependency checks are wired in the database/Redis phase. The route
    already exposes the final API shape so frontend/deployment work can target
    the backend service from the beginning.
    """

    body = HealthResponse(
        status="ok",
        timestamp=datetime.now(UTC),
        service=settings.service_name,
        deep=deep,
    )
    if deep:
        body.database = "not_configured"
        body.redis = "not_configured"
        response.status_code = status.HTTP_200_OK
    return body


@router.get("/ready")
async def ready() -> dict[str, bool]:
    return {"ready": True}
