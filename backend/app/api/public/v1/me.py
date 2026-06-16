from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import ApiPrincipal, get_current_api_principal
from app.api.public.v1.deps import SubscriptionStateDep
from app.api.public.v1.serializers import MeResponse

router = APIRouter(tags=["public"])


@router.get("/me", response_model=MeResponse)
async def me(
    principal: Annotated[ApiPrincipal, Depends(get_current_api_principal)],
    state: SubscriptionStateDep,
) -> MeResponse:
    return MeResponse(
        userId=principal.user_id,
        apiKeyId=principal.api_key_id,
        apiKeyName=principal.api_key_name,
        scopes=sorted(principal.scopes),
        plan=state.plan,
    )
