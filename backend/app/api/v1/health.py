from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel

from app.api.deps import get_settings
from app.core.config import Settings
from app.infrastructure.db.session import health_check as db_health_check
from app.infrastructure.redis import redis_health_check

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
    settings: SettingsDep,
    deep: bool = Query(default=False),
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
        db_ok = await db_health_check()
        redis_ok = await redis_health_check()
        body.database = "connected" if db_ok else "disconnected"
        body.redis = "connected" if redis_ok else "disconnected"
        if not (db_ok and redis_ok):
            body.status = "unhealthy"
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return body


@router.get("/ready")
async def ready() -> dict[str, bool]:
    return {"ready": True}
