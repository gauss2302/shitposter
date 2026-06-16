"""Public-API posts router — list / get / create / patch / delete.

``POST /posts`` accepts ``multipart/form-data``: the server uploads each
attached file to R2 and stores the resulting URL on the post so the
worker (and downstream platforms that pull from URL) can fetch later.
"""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)

from app.api.deps import ApiPrincipal, DbSessionDep, SettingsDep, require_api_scope
from app.api.public.v1.cursor import decode_cursor, encode_cursor
from app.api.public.v1.deps import enforce_read_rate_limit, enforce_write_rate_limit
from app.api.public.v1.serializers import (
    PublicCreatedPostResponse,
    PublicPostResponse,
    PublicPostsPageResponse,
    UpdatePostRequest,
)
from app.api.public.v1.serializers import (
    post as serialize_post,
)
from app.application.media_limits import (
    ALLOWED_MIME_PREFIXES,
    MAX_UPLOAD_BYTES,
    build_storage_key,
)
from app.application.posts_service import PostsService
from app.domain.exceptions import ConflictError, NotFoundError, ValidationError
from app.infrastructure.db.repositories import PostRepository
from app.infrastructure.storage import StorageNotConfigured, get_storage

router = APIRouter(tags=["public"])


def _parse_account_ids(raw: str) -> list[str]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid socialAccountIds format",
        ) from exc
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="socialAccountIds must be a JSON array of strings",
        )
    return parsed


async def _serialize_with_targets(db, post) -> PublicPostResponse:
    repo = PostRepository(db)
    targets = await repo.get_targets(post.id)
    accounts = await repo.list_accounts_by_target_ids(
        [target.social_account_id for target in targets]
    )
    account_by_id = {account.id: account for account in accounts}
    return serialize_post(
        post,
        [(target, account_by_id.get(target.social_account_id)) for target in targets],
    )


@router.get(
    "/posts",
    response_model=PublicPostsPageResponse,
    dependencies=[Depends(enforce_read_rate_limit)],
)
async def list_posts(
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("posts:read"))],
    db: DbSessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: str | None = Query(default=None),
    post_status: Annotated[str | None, Query(alias="status")] = None,
) -> PublicPostsPageResponse:
    decoded_cursor: tuple = None  # type: ignore[assignment]
    if cursor:
        try:
            decoded_cursor = decode_cursor(cursor)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor"
            ) from exc
    enriched, next_cursor = await PostsService(db).list_posts_paginated(
        principal.user_id,
        limit=limit,
        cursor=decoded_cursor,
        status=post_status,
    )
    return PublicPostsPageResponse(
        items=[serialize_post(p, t) for p, t in enriched],
        nextCursor=encode_cursor(*next_cursor) if next_cursor else None,
    )


@router.get(
    "/posts/{post_id}",
    response_model=PublicPostResponse,
    dependencies=[Depends(enforce_read_rate_limit)],
)
async def get_post(
    post_id: str,
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("posts:read"))],
    db: DbSessionDep,
) -> PublicPostResponse:
    post = await PostRepository(db).get_owned(post_id, principal.user_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return await _serialize_with_targets(db, post)


@router.post(
    "/posts",
    response_model=PublicCreatedPostResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(enforce_write_rate_limit)],
)
async def create_post(
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("posts:write"))],
    db: DbSessionDep,
    settings: SettingsDep,
    content: Annotated[str, Form()] = "",
    socialAccountIds: Annotated[str, Form()] = "[]",
    scheduledFor: Annotated[str | None, Form()] = None,
    media: Annotated[list[UploadFile] | None, File()] = None,
) -> PublicCreatedPostResponse:
    account_ids = _parse_account_ids(socialAccountIds)
    media_files = [f for f in (media or []) if f and (f.filename or f.size)]

    uploaded_urls: list[str] = []
    if media_files:
        try:
            storage = get_storage(settings)
        except StorageNotConfigured as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="storage_not_configured",
            ) from exc
        for upload in media_files:
            mime_type = upload.content_type or "application/octet-stream"
            if not mime_type.startswith(ALLOWED_MIME_PREFIXES):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"unsupported_media_type:{mime_type}",
                )
            data = await upload.read()
            if not data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="empty_file"
                )
            if len(data) > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="file_too_large",
                )
            key = build_storage_key(user_id=principal.user_id, mime_type=mime_type)
            stored = await storage.upload_bytes(data=data, key=key, content_type=mime_type)
            uploaded_urls.append(stored.url)

    try:
        created = await PostsService(db).create_post(
            user_id=principal.user_id,
            content=content,
            social_account_ids=account_ids,
            scheduled_for_raw=scheduledFor,
            media_urls=uploaded_urls,
        )
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return PublicCreatedPostResponse(
        success=True,
        post=await _serialize_with_targets(db, created.post),
        targetCount=created.target_count,
        mediaCount=created.media_count,
    )


@router.patch(
    "/posts/{post_id}",
    response_model=PublicPostResponse,
    dependencies=[Depends(enforce_write_rate_limit)],
)
async def update_post(
    post_id: str,
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("posts:write"))],
    db: DbSessionDep,
    payload: Annotated[UpdatePostRequest, Body()],
) -> PublicPostResponse:
    try:
        updated = await PostsService(db).update_scheduled_post(
            user_id=principal.user_id,
            post_id=post_id,
            content=payload.content,
            scheduled_for_raw=payload.scheduledFor,
        )
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return await _serialize_with_targets(db, updated)


@router.delete(
    "/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(enforce_write_rate_limit)],
)
async def cancel_post(
    post_id: str,
    principal: Annotated[ApiPrincipal, Depends(require_api_scope("posts:write"))],
    db: DbSessionDep,
) -> Response:
    try:
        await PostsService(db).cancel_scheduled_post(
            user_id=principal.user_id, post_id=post_id
        )
    except NotFoundError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
