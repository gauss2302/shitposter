from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.application.api_key_service import (
    API_KEY_SCOPES,
    ApiKeyService,
    CreatedApiKey,
    PublicApiKey,
)
from app.application.auth_service import AuthenticatedUser
from app.domain.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


class CreateApiKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scopes: list[str] = Field(default_factory=lambda: list(API_KEY_SCOPES))
    expiresAt: datetime | None = None


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    prefix: str
    scopes: list[str]
    isActive: bool
    expiresAt: str | None = None
    lastUsedAt: str | None = None
    createdAt: str
    updatedAt: str


class CreatedApiKeyResponse(BaseModel):
    apiKey: ApiKeyResponse
    token: str


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _api_key(row: PublicApiKey) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=row.id,
        name=row.name,
        prefix=row.prefix,
        scopes=row.scopes,
        isActive=row.is_active,
        expiresAt=_iso(row.expires_at),
        lastUsedAt=_iso(row.last_used_at),
        createdAt=row.created_at.isoformat(),
        updatedAt=row.updated_at.isoformat(),
    )


def _created_api_key(created: CreatedApiKey) -> CreatedApiKeyResponse:
    return CreatedApiKeyResponse(
        apiKey=_api_key(created.api_key),
        token=created.token,
    )


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(current: CurrentUserDep, db: DbSessionDep) -> list[ApiKeyResponse]:
    rows = await ApiKeyService(db).list_api_keys(current.id)
    return [_api_key(row) for row in rows]


@router.post("", response_model=CreatedApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: CreateApiKeyRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
) -> CreatedApiKeyResponse:
    try:
        created = await ApiKeyService(db).create_api_key(
            user_id=current.id,
            name=payload.name,
            scopes=payload.scopes,
            expires_at=payload.expiresAt,
        )
        await db.commit()
    except ValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _created_api_key(created)


@router.delete("/{api_key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    api_key_id: str,
    current: CurrentUserDep,
    db: DbSessionDep,
) -> None:
    try:
        await ApiKeyService(db).revoke_api_key(current.id, api_key_id)
        await db.commit()
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
