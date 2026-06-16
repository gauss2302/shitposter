"""Cloudflare R2 storage adapter.

R2 is S3-compatible at the API level, so we use ``aioboto3`` against R2's
``https://<account-id>.r2.cloudflarestorage.com`` endpoint.

We expose two URL strategies for objects we just uploaded:

* **Public base URL** — when ``r2_public_base_url`` is set (a Custom Domain on
  the bucket), URLs are stable and never expire. This is the production shape
  for cross-platform UGC where TikTok and Instagram may pull at different times.
* **Presigned GET URLs** — when no public base is configured, we generate a
  short-lived signed URL. Suitable for development and for one-shot platform
  pulls that complete inside the signed window.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import Settings, get_settings


class StorageNotConfigured(RuntimeError):
    """Raised when R2 credentials are missing or incomplete."""


@dataclass(frozen=True)
class StoredObject:
    key: str
    url: str
    size_bytes: int
    content_type: str


class R2Storage:
    def __init__(
        self,
        *,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        public_base_url: str | None = None,
        signed_url_default_expires: int = 86400,
    ) -> None:
        if not (account_id and access_key_id and secret_access_key and bucket):
            raise StorageNotConfigured("R2 credentials are incomplete")
        self._account_id = account_id
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key
        self._bucket = bucket
        self._public_base_url = public_base_url.rstrip("/") if public_base_url else None
        self._signed_url_default_expires = signed_url_default_expires

    @property
    def bucket(self) -> str:
        return self._bucket

    def _client_session(self) -> Any:
        # Lazy import so the backend boots in environments where aioboto3 is
        # not installed (e.g. minimal CI for unrelated tests).
        import aioboto3  # type: ignore[import-untyped]

        session = aioboto3.Session()
        return session.client(
            "s3",
            endpoint_url=f"https://{self._account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=self._access_key_id,
            aws_secret_access_key=self._secret_access_key,
            region_name="auto",
        )

    async def upload_bytes(
        self,
        *,
        data: bytes,
        key: str,
        content_type: str,
    ) -> StoredObject:
        async with self._client_session() as client:
            await client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            url = await self._url_for(client, key)
        return StoredObject(
            key=key,
            url=url,
            size_bytes=len(data),
            content_type=content_type,
        )

    async def get_signed_url(self, *, key: str, expires_in: int | None = None) -> str:
        async with self._client_session() as client:
            return await self._signed_url(
                client, key, expires_in or self._signed_url_default_expires
            )

    async def delete(self, *, key: str) -> None:
        async with self._client_session() as client:
            await client.delete_object(Bucket=self._bucket, Key=key)

    async def _url_for(self, client: Any, key: str) -> str:
        if self._public_base_url:
            return f"{self._public_base_url}/{key}"
        return await self._signed_url(client, key, self._signed_url_default_expires)

    async def _signed_url(self, client: Any, key: str, expires_in: int) -> str:
        url: str = await client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        return url


def get_storage(settings: Settings | None = None) -> R2Storage:
    s = settings or get_settings()
    return R2Storage(
        account_id=s.r2_account_id,
        access_key_id=s.r2_access_key_id,
        secret_access_key=s.r2_secret_access_key,
        bucket=s.r2_bucket,
        public_base_url=s.r2_public_base_url or None,
        signed_url_default_expires=s.r2_signed_url_expires,
    )
