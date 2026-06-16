"""User-generated content upload endpoint.

A single multipart upload lands in Cloudflare R2 and the response carries
back the publicly fetchable URL. Subsequent POST /posts calls reference
that URL via ``mediaUrls`` (or older code paths can still POST base64).

Flow:
    1. Frontend POSTs the file to ``/api/v1/media/upload``.
    2. Backend streams to R2 and returns the URL.
    3. Frontend POSTs ``/api/v1/posts`` with ``mediaUrls=[url]`` instead of
       ``media`` (multipart files).

This keeps large videos (TikTok up to 4GB) from sitting in our request
buffer twice and lets TikTok / Instagram pull from the same stable URL
when we publish.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.api.deps import SettingsDep, get_current_user
from app.application.auth_service import AuthenticatedUser
from app.application.media_limits import (
    ALLOWED_MIME_PREFIXES,
    MAX_UPLOAD_BYTES,
    build_storage_key,
)
from app.infrastructure.storage import StorageNotConfigured, get_storage

router = APIRouter(prefix="/media", tags=["media"])

CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


class UploadedMediaResponse(BaseModel):
    success: bool
    url: str
    key: str
    mimeType: str
    sizeBytes: int


@router.post(
    "/upload",
    response_model=UploadedMediaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_media(
    current: CurrentUserDep,
    settings: SettingsDep,
    file: Annotated[UploadFile, File()],
) -> UploadedMediaResponse:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="filename_required"
        )
    mime_type = file.content_type or "application/octet-stream"
    if not mime_type.startswith(ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unsupported_media_type:{mime_type}",
        )
    data = await file.read()
    size = len(data)
    if size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="empty_file")
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="file_too_large",
        )

    try:
        storage = get_storage(settings)
    except StorageNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="storage_not_configured",
        ) from exc

    key = build_storage_key(user_id=current.id, mime_type=mime_type)
    stored = await storage.upload_bytes(data=data, key=key, content_type=mime_type)
    return UploadedMediaResponse(
        success=True,
        url=stored.url,
        key=stored.key,
        mimeType=stored.content_type,
        sizeBytes=stored.size_bytes,
    )
