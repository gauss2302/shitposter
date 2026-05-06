from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from typing import Any
from urllib.parse import parse_qs, quote, urlencode, urlparse

import httpx

REQUEST_TOKEN_URL = "https://api.x.com/oauth/request_token"
AUTHORIZE_BASE_URL = "https://api.x.com/oauth/authorize"
ACCESS_TOKEN_URL = "https://api.x.com/oauth/access_token"
VERIFY_CREDENTIALS_URL = "https://api.x.com/1.1/account/verify_credentials.json"
UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json"


def _encode(value: str) -> str:
    return quote(value, safe="~")


def _base_url(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def create_oauth1_header(
    method: str,
    url: str,
    params: dict[str, str],
    *,
    consumer_key: str,
    consumer_secret: str,
    access_token: str = "",
    access_token_secret: str = "",
) -> str:
    oauth_params = {
        "oauth_consumer_key": consumer_key,
        "oauth_nonce": secrets.token_hex(16),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_version": "1.0",
    }
    if access_token:
        oauth_params["oauth_token"] = access_token
    all_params = {**params, **oauth_params}
    normalized = "&".join(
        f"{_encode(key)}={_encode(value)}" for key, value in sorted(all_params.items())
    )
    base_string = "&".join(
        [_encode(method.upper()), _encode(_base_url(url)), _encode(normalized)]
    )
    signing_key = f"{_encode(consumer_secret)}&{_encode(access_token_secret)}"
    signature = base64.b64encode(
        hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1).digest()
    ).decode()
    oauth_params["oauth_signature"] = signature
    return "OAuth " + ", ".join(
        f'{_encode(key)}="{_encode(value)}"' for key, value in sorted(oauth_params.items())
    )


async def generate_twitter_oauth1_auth_link(
    *,
    callback_url: str,
    consumer_key: str,
    consumer_secret: str,
) -> dict[str, str]:
    params = {"oauth_callback": callback_url}
    auth_header = create_oauth1_header(
        "POST",
        REQUEST_TOKEN_URL,
        params,
        consumer_key=consumer_key,
        consumer_secret=consumer_secret,
    )
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(REQUEST_TOKEN_URL, headers={"Authorization": auth_header})
    if not response.is_success:
        raise RuntimeError(f"Twitter OAuth1 request token failed: {response.text}")
    parsed = {key: values[0] for key, values in parse_qs(response.text).items()}
    if parsed.get("oauth_callback_confirmed") != "true":
        raise RuntimeError("Twitter OAuth1 callback was not confirmed")
    oauth_token = parsed["oauth_token"]
    return {
        "url": f"{AUTHORIZE_BASE_URL}?oauth_token={_encode(oauth_token)}",
        "oauth_token": oauth_token,
        "oauth_token_secret": parsed["oauth_token_secret"],
    }


async def exchange_twitter_oauth1_access_token(
    *,
    oauth_token: str,
    oauth_token_secret: str,
    oauth_verifier: str,
    consumer_key: str,
    consumer_secret: str,
) -> dict[str, str]:
    params = {"oauth_verifier": oauth_verifier}
    auth_header = create_oauth1_header(
        "POST",
        ACCESS_TOKEN_URL,
        params,
        consumer_key=consumer_key,
        consumer_secret=consumer_secret,
        access_token=oauth_token,
        access_token_secret=oauth_token_secret,
    )
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(ACCESS_TOKEN_URL, headers={"Authorization": auth_header})
    if not response.is_success:
        raise RuntimeError(f"Twitter OAuth1 access token failed: {response.text}")
    return {key: values[0] for key, values in parse_qs(response.text).items()}


async def verify_twitter_oauth1_credentials(
    *,
    access_token: str,
    access_token_secret: str,
    consumer_key: str,
    consumer_secret: str,
) -> dict[str, Any]:
    auth_header = create_oauth1_header(
        "GET",
        VERIFY_CREDENTIALS_URL,
        {},
        consumer_key=consumer_key,
        consumer_secret=consumer_secret,
        access_token=access_token,
        access_token_secret=access_token_secret,
    )
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(VERIFY_CREDENTIALS_URL, headers={"Authorization": auth_header})
    if not response.is_success:
        return {}
    return response.json()


async def upload_media_to_twitter(
    *,
    media: bytes,
    mime_type: str,
    access_token: str,
    access_token_secret: str,
    consumer_key: str,
    consumer_secret: str,
) -> str:
    params = {
        "command": "INIT",
        "total_bytes": str(len(media)),
        "media_type": mime_type,
        "media_category": "tweet_video" if mime_type.startswith("video/") else "tweet_image",
    }
    auth_header = create_oauth1_header(
        "POST",
        UPLOAD_URL,
        params,
        consumer_key=consumer_key,
        consumer_secret=consumer_secret,
        access_token=access_token,
        access_token_secret=access_token_secret,
    )
    async with httpx.AsyncClient(timeout=60) as client:
        init = await client.post(
            UPLOAD_URL,
            data=urlencode(params),
            headers={
                "Authorization": auth_header,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        if not init.is_success:
            raise RuntimeError(f"Twitter media INIT failed: {init.text}")
        media_id = str(init.json()["media_id_string"])
        append_params = {"command": "APPEND", "media_id": media_id, "segment_index": "0"}
        append_header = create_oauth1_header(
            "POST",
            UPLOAD_URL,
            append_params,
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )
        append = await client.post(
            UPLOAD_URL,
            data={**append_params, "media": media},
            headers={"Authorization": append_header},
        )
        if not append.is_success:
            raise RuntimeError(f"Twitter media APPEND failed: {append.text}")
        finalize_params = {"command": "FINALIZE", "media_id": media_id}
        finalize_header = create_oauth1_header(
            "POST",
            UPLOAD_URL,
            finalize_params,
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            access_token=access_token,
            access_token_secret=access_token_secret,
        )
        finalize = await client.post(
            UPLOAD_URL,
            data=urlencode(finalize_params),
            headers={
                "Authorization": finalize_header,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        if not finalize.is_success:
            raise RuntimeError(f"Twitter media FINALIZE failed: {finalize.text}")
    return media_id

