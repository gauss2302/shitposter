from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import ApiPrincipal, DbSessionDep, require_api_scope
from app.api.public.v1.deps import enforce_read_rate_limit
from app.api.public.v1.serializers import PublicSocialAccountResponse, social_account
from app.infrastructure.db.repositories import SocialAccountRepository

router = APIRouter(tags=["public"])


@router.get(
    "/accounts",
    response_model=list[PublicSocialAccountResponse],
    dependencies=[Depends(enforce_read_rate_limit)],
)
async def list_accounts(
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("accounts:read"))],
    db: DbSessionDep,
) -> list[PublicSocialAccountResponse]:
    rows = await SocialAccountRepository(db).list_for_user(principal.user_id)
    return [social_account(row) for row in rows if row.is_active]
