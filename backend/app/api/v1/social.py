from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.application.auth_service import AuthenticatedUser
from app.application.social_service import SocialService
from app.domain.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/social", tags=["social"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


class UpdateSocialAccountRequest(BaseModel):
    isActive: bool | None = None


@router.get("/connect/{platform}")
async def connect_platform(
    platform: str,
    current: CurrentUserDep,
    db: DbSessionDep,
) -> RedirectResponse:
    try:
        url = await SocialService(db).build_oauth2_authorization_url(
            user_id=current.user.id,
            platform=platform,
        )
    except ValidationError as exc:
        return RedirectResponse(f"/dashboard/accounts?error={str(exc)}")
    return RedirectResponse(url)


@router.get("/callback/{platform}")
async def callback_platform(platform: str, request: Request, db: DbSessionDep) -> RedirectResponse:
    try:
        await SocialService(db).handle_oauth2_callback(
            platform=platform,
            code=request.query_params.get("code"),
            state=request.query_params.get("state"),
            error=request.query_params.get("error"),
        )
        await db.commit()
    except ValidationError as exc:
        await db.rollback()
        return RedirectResponse(f"/dashboard/accounts?error={str(exc)}")
    return RedirectResponse("/dashboard/accounts?success=connected")


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    current: CurrentUserDep,
    db: DbSessionDep,
) -> dict[str, bool]:
    try:
        await SocialService(db).delete_account(current.user.id, account_id)
        await db.commit()
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"success": True}


@router.patch("/accounts/{account_id}")
async def update_account(
    account_id: str,
    payload: UpdateSocialAccountRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
) -> dict[str, bool]:
    try:
        await SocialService(db).update_account(
            current.user.id,
            account_id,
            is_active=payload.isActive,
        )
        await db.commit()
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"success": True}
