from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SettingsDep, get_current_user, get_db_session
from app.application.auth_service import AuthenticatedUser
from app.application.recipe_service import (
    FREQUENCY_DELTAS,
    PublicRecipe,
    RecipeService,
)
from app.domain.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/recipes", tags=["recipes"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


class CreateRecipeRequest(BaseModel):
    name: str = Field(..., min_length=1)
    provider: str = "replicate"
    model: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    captionTemplate: str | None = None
    params: dict[str, object] | None = None
    targetSocialAccountIds: list[str] = Field(default_factory=list)
    frequency: str
    isActive: bool = True


class UpdateRecipeRequest(BaseModel):
    name: str | None = None
    prompt: str | None = None
    captionTemplate: str | None = None
    params: dict[str, object] | None = None
    targetSocialAccountIds: list[str] | None = None
    frequency: str | None = None
    isActive: bool | None = None


class RecipeResponse(BaseModel):
    id: str
    name: str
    provider: str
    model: str
    prompt: str
    captionTemplate: str | None
    params: dict[str, object]
    targetSocialAccountIds: list[str]
    frequency: str
    isActive: bool
    nextRunAt: str | None
    lastRunAt: str | None
    lastRunJobId: str | None
    createdAt: str
    updatedAt: str

    @classmethod
    def from_domain(cls, recipe: PublicRecipe) -> RecipeResponse:
        return cls(
            id=recipe.id,
            name=recipe.name,
            provider=recipe.provider,
            model=recipe.model,
            prompt=recipe.prompt,
            captionTemplate=recipe.captionTemplate,
            params=recipe.params,
            targetSocialAccountIds=recipe.targetSocialAccountIds,
            frequency=recipe.frequency,
            isActive=recipe.isActive,
            nextRunAt=_iso_or_none(recipe.nextRunAt),
            lastRunAt=_iso_or_none(recipe.lastRunAt),
            lastRunJobId=recipe.lastRunJobId,
            createdAt=recipe.createdAt.isoformat(),
            updatedAt=recipe.updatedAt.isoformat(),
        )


class RecipeListResponse(BaseModel):
    recipes: list[RecipeResponse]
    supportedFrequencies: list[str]


def _iso_or_none(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


@router.get("", response_model=RecipeListResponse)
async def list_recipes(
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> RecipeListResponse:
    recipes = await RecipeService(db, settings).list_recipes(current.id)
    return RecipeListResponse(
        recipes=[RecipeResponse.from_domain(r) for r in recipes],
        supportedFrequencies=sorted(FREQUENCY_DELTAS),
    )


@router.post(
    "", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED
)
async def create_recipe(
    payload: CreateRecipeRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> RecipeResponse:
    try:
        recipe = await RecipeService(db, settings).create_recipe(
            user_id=current.id,
            name=payload.name,
            provider=payload.provider,
            model=payload.model,
            prompt=payload.prompt,
            caption_template=payload.captionTemplate,
            params=dict(payload.params) if payload.params else None,
            target_social_account_ids=payload.targetSocialAccountIds,
            frequency=payload.frequency,
            is_active=payload.isActive,
        )
    except ValidationError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return RecipeResponse.from_domain(recipe)


@router.patch("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: str,
    payload: UpdateRecipeRequest,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> RecipeResponse:
    try:
        recipe = await RecipeService(db, settings).update_recipe(
            user_id=current.id,
            recipe_id=recipe_id,
            name=payload.name,
            prompt=payload.prompt,
            caption_template=payload.captionTemplate,
            params=dict(payload.params) if payload.params else None,
            target_social_account_ids=payload.targetSocialAccountIds,
            frequency=payload.frequency,
            is_active=payload.isActive,
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ValidationError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    return RecipeResponse.from_domain(recipe)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: str,
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> None:
    try:
        await RecipeService(db, settings).delete_recipe(
            user_id=current.id, recipe_id=recipe_id
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
