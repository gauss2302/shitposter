from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_settings
from app.application.auth_service import AuthenticatedUser
from app.application.billing_service import BillingService
from app.core.config import Settings
from app.domain.exceptions import ValidationError

router = APIRouter(prefix="/billing", tags=["billing"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


class CheckoutRequest(BaseModel):
    plan: str


@router.post("/checkout")
async def checkout(
    payload: CheckoutRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> dict[str, str]:
    try:
        return await BillingService(db, settings).create_checkout(
            user_id=current.user.id,
            email=current.user.email,
            name=current.user.name,
            plan=payload.plan,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.post("/portal")
async def portal(
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> dict[str, str]:
    try:
        return await BillingService(db, settings).create_portal(user_id=current.user.id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.post("/webhook/polar", status_code=status.HTTP_202_ACCEPTED)
async def polar_webhook(
    request: Request,
    db: DbSessionDep,
    settings: SettingsDep,
) -> dict[str, bool]:
    raw_body = await request.body()
    signature = request.headers.get("webhook-signature") or request.headers.get("polar-signature")
    try:
        await BillingService(db, settings).handle_polar_webhook(raw_body, signature)
        await db.commit()
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return {"accepted": True}
