"""Replicate Predictions API adapter for async video generation.

Replicate is a model gateway; we use it as a single adapter for many video
models including Kling (``kwaivgi/kling-v2.1``), Pika, Luma, Hunyuan, and
Higgsfield-style cinematic models. One auth + one polling shape covers all.

Auth: ``Authorization: Token <api_token>`` (legacy) or ``Bearer <api_token>``
(also accepted). We use the Token form which is what the docs lead with.

Endpoints used:

* ``POST /v1/predictions`` — create a prediction. Body either:

  * ``{"version": "<version-id>", "input": {...}}`` for pinned versions, or
  * ``{"model": "owner/name", "input": {...}}`` for "use latest version".

* ``GET /v1/predictions/{id}`` — fetch current state.
* ``POST /v1/predictions/{id}/cancel`` — cancel a running prediction.

Status flow: ``starting`` → ``processing`` → ``succeeded`` | ``failed`` |
``canceled``. The ``output`` field is model-specific; for video models it
is typically a URL string (or list of URLs).
"""

from __future__ import annotations

from typing import Any

import httpx

_DEFAULT_TIMEOUT = httpx.Timeout(60.0, connect=10.0)
_BASE_URL = "https://api.replicate.com/v1"


class ReplicateApiError(RuntimeError):
    """Raised when Replicate returns a non-success response."""


async def create_replicate_prediction(
    *,
    api_token: str,
    model: str,
    input: dict[str, Any],
    version: str | None = None,
    webhook: str | None = None,
) -> dict[str, Any]:
    """Submit a prediction. Returns the initial prediction object.

    Use ``version`` for reproducibility, or omit (and pass ``model`` only)
    to run the model's latest version.
    """
    body: dict[str, Any] = {"input": input}
    if version:
        body["version"] = version
    else:
        body["model"] = model
    if webhook:
        body["webhook"] = webhook
        body["webhook_events_filter"] = ["completed"]
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{_BASE_URL}/predictions",
            json=body,
            headers=_auth_headers(api_token),
        )
    return _parse_response(response)


async def get_replicate_prediction(
    *,
    api_token: str,
    prediction_id: str,
) -> dict[str, Any]:
    """Fetch the latest state of an in-flight prediction."""
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.get(
            f"{_BASE_URL}/predictions/{prediction_id}",
            headers=_auth_headers(api_token),
        )
    return _parse_response(response)


async def cancel_replicate_prediction(
    *,
    api_token: str,
    prediction_id: str,
) -> dict[str, Any]:
    """Cancel a running prediction."""
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{_BASE_URL}/predictions/{prediction_id}/cancel",
            headers=_auth_headers(api_token),
        )
    return _parse_response(response)


def extract_video_url(output: Any) -> str | None:
    """Normalize a Replicate ``output`` field to a single URL.

    Video models return either a URL string, a list with one URL, or a
    list of URLs (we take the first). Returns None if no URL is recoverable.
    """
    if isinstance(output, str) and output.startswith(("http://", "https://")):
        return output
    if isinstance(output, list) and output:
        first = output[0]
        if isinstance(first, str) and first.startswith(("http://", "https://")):
            return first
    return None


def _auth_headers(api_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Token {api_token}",
        "Content-Type": "application/json",
    }


def _parse_response(response: httpx.Response) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError as exc:
        raise ReplicateApiError(
            f"Replicate returned non-JSON ({response.status_code}): "
            f"{response.text[:200]}"
        ) from exc
    if not isinstance(body, dict):
        raise ReplicateApiError(f"Replicate returned non-object JSON: {body!r}")
    if response.status_code >= 400:
        title = body.get("title") or "error"
        detail = body.get("detail") or body.get("error") or response.text
        raise ReplicateApiError(f"Replicate API error ({title}): {detail}")
    return body
