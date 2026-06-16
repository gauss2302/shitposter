"""Public-API AI router — provider CRUD + content generation.

Wraps the existing :class:`AiService` so logic stays in one place.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import ApiPrincipal, DbSessionDep, SettingsDep, require_api_scope
from app.api.public.v1.deps import enforce_read_rate_limit, enforce_write_rate_limit
from app.api.public.v1.serializers import (
    PublicAiCandidateResponse,
    PublicAiGenerateRequest,
    PublicAiGenerateResponse,
    PublicAiProviderCredentialRequest,
    PublicAiProviderCredentialResponse,
    PublicAiProviderCredentialUpdateRequest,
)
from app.application.ai_service import (
    AiGenerationCandidate,
    AiService,
    PublicAiCredential,
)
from app.domain.exceptions import NotFoundError, ValidationError

router = APIRouter(tags=["public"])


def _credential(row: PublicAiCredential) -> PublicAiProviderCredentialResponse:
    return PublicAiProviderCredentialResponse(
        id=row.id,
        provider=row.provider,
        displayName=row.display_name,
        baseUrl=row.base_url,
        defaultModel=row.default_model,
        isActive=row.is_active,
        createdAt=row.created_at.isoformat(),
        updatedAt=row.updated_at.isoformat(),
    )


def _candidate(row: AiGenerationCandidate) -> PublicAiCandidateResponse:
    return PublicAiCandidateResponse(
        content=row.content,
        platformFit=row.platform_fit,
        charCount=row.char_count,
        warnings=row.warnings,
    )


@router.get(
    "/ai/providers",
    response_model=list[PublicAiProviderCredentialResponse],
    dependencies=[Depends(enforce_read_rate_limit)],
)
async def list_providers(
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("ai:providers:read"))],
    db: DbSessionDep,
    settings: SettingsDep,
) -> list[PublicAiProviderCredentialResponse]:
    rows = await AiService(db, settings).list_credentials(principal.user_id)
    return [_credential(row) for row in rows]


@router.post(
    "/ai/providers",
    response_model=PublicAiProviderCredentialResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(enforce_write_rate_limit)],
)
async def create_provider(
    payload: PublicAiProviderCredentialRequest,
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("ai:providers:write"))],
    db: DbSessionDep,
    settings: SettingsDep,
) -> PublicAiProviderCredentialResponse:
    try:
        row = await AiService(db, settings).create_credential(
            user_id=principal.user_id,
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


@router.patch(
    "/ai/providers/{credential_id}",
    response_model=PublicAiProviderCredentialResponse,
    dependencies=[Depends(enforce_write_rate_limit)],
)
async def update_provider(
    credential_id: str,
    payload: PublicAiProviderCredentialUpdateRequest,
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("ai:providers:write"))],
    db: DbSessionDep,
    settings: SettingsDep,
) -> PublicAiProviderCredentialResponse:
    try:
        row = await AiService(db, settings).update_credential(
            user_id=principal.user_id,
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


@router.delete(
    "/ai/providers/{credential_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(enforce_write_rate_limit)],
)
async def delete_provider(
    credential_id: str,
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("ai:providers:write"))],
    db: DbSessionDep,
    settings: SettingsDep,
) -> None:
    try:
        await AiService(db, settings).delete_credential(
            user_id=principal.user_id, credential_id=credential_id
        )
        await db.commit()
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/ai/generate",
    response_model=PublicAiGenerateResponse,
    dependencies=[Depends(enforce_write_rate_limit)],
)
async def generate(
    payload: PublicAiGenerateRequest,
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("ai:generate"))],
    db: DbSessionDep,
    settings: SettingsDep,
) -> PublicAiGenerateResponse:
    try:
        result = await AiService(db, settings).generate(
            user_id=principal.user_id,
            prompt=payload.prompt,
            provider_credential_id=payload.providerCredentialId,
            provider=payload.provider,
            model=payload.model,
            platforms=payload.platforms,
            social_account_ids=payload.socialAccountIds,
            language=payload.language or "English",
            tone=payload.tone or "clear, useful, and engaging",
            max_candidates=payload.maxCandidates,
            context=str(payload.context) if payload.context else None,
        )
    except (NotFoundError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PublicAiGenerateResponse(
        candidates=[_candidate(c) for c in result.candidates],
        provider=result.provider,
        model=result.model,
    )
