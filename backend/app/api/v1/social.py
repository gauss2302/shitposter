from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_settings
from app.application.auth_service import AuthenticatedUser
from app.application.social_service import SocialService
from app.core.config import Settings
from app.domain.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/social", tags=["social"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


class UpdateSocialAccountRequest(BaseModel):
    isActive: bool | None = None


@router.get("/connect/twitter-oauth1")
async def connect_twitter_oauth1(
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> RedirectResponse:
    try:
        url = await SocialService(db, settings).build_twitter_oauth1_connect_url(current.id)
    except ValidationError as exc:
        return RedirectResponse(f"/dashboard/accounts?error={str(exc)}")
    return RedirectResponse(url)


@router.get("/callback/twitter-oauth1")
async def callback_twitter_oauth1(
    request: Request,
    db: DbSessionDep,
    settings: SettingsDep,
) -> RedirectResponse:
    denied = request.query_params.get("denied")
    if denied:
        return RedirectResponse("/dashboard/accounts?error=oauth1_denied")
    try:
        await SocialService(db, settings).handle_twitter_oauth1_callback(
            oauth_token=request.query_params.get("oauth_token"),
            oauth_verifier=request.query_params.get("oauth_verifier"),
            denied=denied,
        )
        await db.commit()
    except ValidationError as exc:
        await db.rollback()
        return RedirectResponse(f"/dashboard/accounts?error={str(exc)}")
    return RedirectResponse("/dashboard/accounts?success=oauth1_connected")


@router.get("/connect/{platform}")
async def connect_platform(
    platform: str,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> RedirectResponse:
    try:
        url = await SocialService(db, settings).build_connect_url(
            user_id=current.id,
            platform=platform,
        )
    except ValidationError as exc:
        return RedirectResponse(f"/dashboard/accounts?error={str(exc)}")
    return RedirectResponse(url)


@router.get("/callback/{platform}")
async def callback_platform(
    platform: str,
    request: Request,
    db: DbSessionDep,
    settings: SettingsDep,
) -> RedirectResponse:
    try:
        await SocialService(db, settings).handle_oauth2_callback(
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
    settings: SettingsDep,
) -> dict[str, bool]:
    try:
        await SocialService(db, settings).disconnect_account(current.id, account_id)
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
    settings: SettingsDep,
) -> dict[str, bool]:
    try:
        await SocialService(db, settings).update_account(
            current.id,
            account_id,
            is_active=payload.isActive,
        )
        await db.commit()
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"success": True}
