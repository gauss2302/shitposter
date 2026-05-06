from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_settings
from app.application.ai_service import (
    AI_PROVIDERS,
    AiGenerationCandidate,
    AiService,
    PublicAiCredential,
)
from app.application.auth_service import AuthenticatedUser
from app.core.config import Settings
from app.domain.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/ai", tags=["ai"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


class AiProviderCredentialRequest(BaseModel):
    provider: str = Field(pattern=f"^({'|'.join(AI_PROVIDERS)})$")
    displayName: str = Field(min_length=1, max_length=120)
    apiKey: str = Field(min_length=1, max_length=4096)
    baseUrl: str | None = None
    defaultModel: str = Field(min_length=1, max_length=200)


class UpdateAiProviderCredentialRequest(BaseModel):
    displayName: str | None = Field(default=None, min_length=1, max_length=120)
    apiKey: str | None = Field(default=None, min_length=1, max_length=4096)
    baseUrl: str | None = None
    defaultModel: str | None = Field(default=None, min_length=1, max_length=200)
    isActive: bool | None = None


class AiProviderCredentialResponse(BaseModel):
    id: str
    provider: str
    displayName: str
    baseUrl: str | None = None
    defaultModel: str
    isActive: bool
    createdAt: str
    updatedAt: str


class AiGenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    providerCredentialId: str | None = None
    provider: str | None = Field(default=None, pattern=f"^({'|'.join(AI_PROVIDERS)})$")
    model: str | None = None
    socialAccountIds: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    language: str | None = None
    tone: str | None = None
    maxCandidates: int = Field(default=1, ge=1, le=5)
    context: dict[str, object] = Field(default_factory=dict)


class GeneratedCandidateResponse(BaseModel):
    content: str
    platformFit: dict[str, bool]
    charCount: int
    warnings: list[str]


class AiGenerateResponse(BaseModel):
    candidates: list[GeneratedCandidateResponse]
    provider: str
    model: str


def _credential(row: PublicAiCredential) -> AiProviderCredentialResponse:
    return AiProviderCredentialResponse(
        id=row.id,
        provider=row.provider,
        displayName=row.display_name,
        baseUrl=row.base_url,
        defaultModel=row.default_model,
        isActive=row.is_active,
        createdAt=row.created_at.isoformat(),
        updatedAt=row.updated_at.isoformat(),
    )


def _candidate(row: AiGenerationCandidate) -> GeneratedCandidateResponse:
    return GeneratedCandidateResponse(
        content=row.content,
        platformFit=row.platform_fit,
        charCount=row.char_count,
        warnings=row.warnings,
    )


@router.get("/providers", response_model=list[AiProviderCredentialResponse])
async def list_providers(
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> list[AiProviderCredentialResponse]:
    rows = await AiService(db, settings).list_credentials(current.id)
    return [_credential(row) for row in rows]


@router.post(
    "/providers",
    response_model=AiProviderCredentialResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_provider(
    payload: AiProviderCredentialRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> AiProviderCredentialResponse:
    try:
        row = await AiService(db, settings).create_credential(
            user_id=current.id,
            provider=payload.provider,
            display_name=payload.displayName,
            api_key=payload.apiKey,
            base_url=payload.baseUrl,
            default_model=payload.defaultModel,
        )
        await db.commit()
    except ValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _credential(row)


@router.patch("/providers/{credential_id}", response_model=AiProviderCredentialResponse)
async def update_provider(
    credential_id: str,
    payload: UpdateAiProviderCredentialRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> AiProviderCredentialResponse:
    try:
        row = await AiService(db, settings).update_credential(
            user_id=current.id,
            credential_id=credential_id,
            display_name=payload.displayName,
            api_key=payload.apiKey,
            base_url=payload.baseUrl,
            default_model=payload.defaultModel,
            is_active=payload.isActive,
        )
        await db.commit()
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _credential(row)


@router.delete("/providers/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    credential_id: str,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> None:
    try:
        await AiService(db, settings).delete_credential(current.id, credential_id)
        await db.commit()
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/generate", response_model=AiGenerateResponse)
async def generate(
    payload: AiGenerateRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> AiGenerateResponse:
    try:
        result = await AiService(db, settings).generate(
            user_id=current.id,
            prompt=payload.prompt,
            provider_credential_id=payload.providerCredentialId,
            provider=payload.provider,
            model=payload.model,
            social_account_ids=payload.socialAccountIds,
            platforms=payload.platforms,
            language=payload.language or "English",
            tone=payload.tone or "clear, useful, and engaging",
            max_candidates=payload.maxCandidates,
            context=str(payload.context) if payload.context else None,
        )
    except (NotFoundError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AiGenerateResponse(
        candidates=[_candidate(row) for row in result.candidates],
        provider=result.provider,
        model=result.model,
    )
