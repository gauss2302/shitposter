from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.application.auth_service import AuthenticatedUser
from app.application.posts_service import PostsService, file_to_media
from app.domain.exceptions import ValidationError

router = APIRouter(prefix="/posts", tags=["posts"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


class CreatedPostResponse(BaseModel):
    success: bool
    post: dict[str, object]


@router.post("", response_model=CreatedPostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    current: CurrentUserDep,
    db: DbSessionDep,
    content: Annotated[str, Form()] = "",
    socialAccountIds: Annotated[str, Form()] = "[]",
    scheduledFor: Annotated[str | None, Form()] = None,
    media: Annotated[list[UploadFile] | None, File()] = None,
) -> CreatedPostResponse:
    try:
        account_ids = json.loads(socialAccountIds)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid socialAccountIds format",
        ) from exc

    if not isinstance(account_ids, list) or not all(isinstance(item, str) for item in account_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one account is required",
        )

    try:
        media_inputs = [await file_to_media(file) for file in media or []]
        created = await PostsService(db).create_post(
            user_id=current.id,
            content=content,
            social_account_ids=account_ids,
            scheduled_for_raw=scheduledFor,
            media=media_inputs,
        )
    except ValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return CreatedPostResponse(
        success=True,
        post={
            "id": created.post.id,
            "status": created.post.status,
            "scheduledFor": created.post.scheduled_for.isoformat()
            if created.post.scheduled_for
            else None,
            "targetCount": created.target_count,
            "mediaCount": created.media_count,
        },
    )
