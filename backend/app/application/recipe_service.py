"""Recipe service — schedule "generate a video and post it" on a fixed cadence.

A recipe couples (provider, model, prompt, params) with a target list of
social accounts and a discrete frequency. The recipe scheduler worker
fires due recipes every minute; the recipe handler kicks off a video
generation job whose metadata carries the recipe id and target accounts.
When the polling worker uploads the rendered video to R2 it creates a
``Post`` + ``PostTarget`` rows and enqueues the existing publish workers.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.domain.enums import VideoProvider
from app.domain.exceptions import NotFoundError, ValidationError
from app.infrastructure.db import models
from app.infrastructure.db.repositories import (
    SocialAccountRepository,
    VideoRecipeRepository,
)

# Discrete cadences keep the cron parser out of the build. Add more entries
# as we need them. The keys are the values stored in ``video_recipe.frequency``.
FREQUENCY_DELTAS: dict[str, timedelta] = {
    "every_15min": timedelta(minutes=15),
    "every_30min": timedelta(minutes=30),
    "hourly": timedelta(hours=1),
    "every_2h": timedelta(hours=2),
    "every_6h": timedelta(hours=6),
    "every_12h": timedelta(hours=12),
    "daily": timedelta(days=1),
}


@dataclass(frozen=True, slots=True)
class PublicRecipe:
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
    nextRunAt: datetime | None
    lastRunAt: datetime | None
    lastRunJobId: str | None
    createdAt: datetime
    updatedAt: datetime


def to_public_recipe(row: models.VideoRecipe) -> PublicRecipe:
    return PublicRecipe(
        id=row.id,
        name=row.name,
        provider=row.provider,
        model=row.model,
        prompt=row.prompt,
        captionTemplate=row.caption_template,
        params=_parse_json_object(row.params_json),
        targetSocialAccountIds=_parse_json_list(row.target_social_account_ids_json),
        frequency=row.frequency,
        isActive=row.is_active,
        nextRunAt=row.next_run_at,
        lastRunAt=row.last_run_at,
        lastRunJobId=row.last_run_job_id,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def advance_next_run(*, frequency: str, anchor: datetime) -> datetime:
    """Compute the next fire time given a fixed cadence."""
    delta = FREQUENCY_DELTAS.get(frequency)
    if delta is None:
        raise ValidationError(f"Unsupported frequency: {frequency}")
    return anchor + delta


class RecipeService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.recipes = VideoRecipeRepository(session)
        self.social_accounts = SocialAccountRepository(session)

    async def list_recipes(self, user_id: str) -> list[PublicRecipe]:
        rows = await self.recipes.list_for_user(user_id)
        return [to_public_recipe(row) for row in rows]

    async def get(self, *, user_id: str, recipe_id: str) -> PublicRecipe:
        row = await self.recipes.get_owned(recipe_id, user_id)
        if row is None:
            raise NotFoundError("Recipe not found")
        return to_public_recipe(row)

    async def create_recipe(
        self,
        *,
        user_id: str,
        name: str,
        provider: str,
        model: str,
        prompt: str,
        target_social_account_ids: Sequence[str],
        frequency: str,
        params: dict[str, object] | None = None,
        caption_template: str | None = None,
        is_active: bool = True,
    ) -> PublicRecipe:
        if not name.strip():
            raise ValidationError("Recipe name is required")
        if not prompt.strip():
            raise ValidationError("Prompt is required")
        if not model.strip():
            raise ValidationError("Model is required")
        try:
            VideoProvider(provider)
        except ValueError as exc:
            raise ValidationError(f"Unsupported video provider: {provider}") from exc
        if frequency not in FREQUENCY_DELTAS:
            raise ValidationError(
                f"Unsupported frequency: {frequency}. "
                f"Allowed: {', '.join(sorted(FREQUENCY_DELTAS))}"
            )
        if not target_social_account_ids:
            raise ValidationError("At least one target account is required")

        accounts = await self.social_accounts.list_owned_by_ids(
            user_id, list(target_social_account_ids)
        )
        if len(accounts) != len(set(target_social_account_ids)):
            raise NotFoundError("One or more target accounts not found or not owned")

        now = datetime.now(UTC).replace(tzinfo=None)
        next_run = advance_next_run(frequency=frequency, anchor=now) if is_active else None
        row = await self.recipes.add(
            models.VideoRecipe(
                id=uuid4().hex,
                user_id=user_id,
                name=name.strip(),
                provider=provider,
                model=model.strip(),
                prompt=prompt.strip(),
                caption_template=caption_template.strip() if caption_template else None,
                params_json=json.dumps(params or {}),
                target_social_account_ids_json=json.dumps(list(target_social_account_ids)),
                frequency=frequency,
                is_active=is_active,
                next_run_at=next_run,
                created_at=now,
                updated_at=now,
            )
        )
        await self.session.commit()
        return to_public_recipe(row)

    async def update_recipe(
        self,
        *,
        user_id: str,
        recipe_id: str,
        name: str | None = None,
        prompt: str | None = None,
        caption_template: str | None = None,
        params: dict[str, object] | None = None,
        target_social_account_ids: Sequence[str] | None = None,
        frequency: str | None = None,
        is_active: bool | None = None,
    ) -> PublicRecipe:
        row = await self.recipes.get_owned(recipe_id, user_id)
        if row is None:
            raise NotFoundError("Recipe not found")
        if name is not None:
            row.name = name.strip() or row.name
        if prompt is not None and prompt.strip():
            row.prompt = prompt.strip()
        if caption_template is not None:
            row.caption_template = caption_template.strip() or None
        if params is not None:
            row.params_json = json.dumps(params)
        if target_social_account_ids is not None:
            accounts = await self.social_accounts.list_owned_by_ids(
                user_id, list(target_social_account_ids)
            )
            if len(accounts) != len(set(target_social_account_ids)):
                raise NotFoundError("One or more target accounts not found or not owned")
            row.target_social_account_ids_json = json.dumps(list(target_social_account_ids))
        if frequency is not None:
            if frequency not in FREQUENCY_DELTAS:
                raise ValidationError(f"Unsupported frequency: {frequency}")
            row.frequency = frequency
        if is_active is not None:
            row.is_active = is_active
            now = datetime.now(UTC).replace(tzinfo=None)
            if is_active and row.next_run_at is None:
                row.next_run_at = advance_next_run(frequency=row.frequency, anchor=now)
            elif not is_active:
                row.next_run_at = None
        row.updated_at = datetime.now(UTC).replace(tzinfo=None)
        await self.recipes.flush()
        await self.session.commit()
        return to_public_recipe(row)

    async def delete_recipe(self, *, user_id: str, recipe_id: str) -> None:
        row = await self.recipes.get_owned(recipe_id, user_id)
        if row is None:
            raise NotFoundError("Recipe not found")
        await self.recipes.delete(row)
        await self.session.commit()


def _parse_json_object(raw: str | None) -> dict[str, object]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _parse_json_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed]
