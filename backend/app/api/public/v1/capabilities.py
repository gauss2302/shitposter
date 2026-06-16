from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import ApiPrincipal, require_api_scope
from app.api.public.v1.deps import enforce_read_rate_limit
from app.api.public.v1.serializers import PlatformCapabilityResponse, all_capabilities

router = APIRouter(tags=["public"])


@router.get(
    "/capabilities",
    response_model=list[PlatformCapabilityResponse],
    dependencies=[Depends(enforce_read_rate_limit)],
)
async def capabilities(
    _principal: Annotated[ApiPrincipal, Depends(require_api_scope("accounts:read"))],
) -> list[PlatformCapabilityResponse]:
    return all_capabilities()
