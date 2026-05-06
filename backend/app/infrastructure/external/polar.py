from __future__ import annotations

from typing import Any

import httpx

from app.core.config import Settings


class PolarNotConfiguredError(RuntimeError):
    """Raised when Polar endpoints are called without credentials."""


class PolarClient:
    def __init__(self, settings: Settings) -> None:
        self.access_token = settings.polar_access_token
        self.base_url = (settings.polar_server_url or "https://api.polar.sh").rstrip("/")

    @property
    def configured(self) -> bool:
        return bool(self.access_token)

    async def create_checkout(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            raise PolarNotConfiguredError("Polar is not configured")
        return await self._post("/v1/checkouts/", payload)

    async def create_customer_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            raise PolarNotConfiguredError("Polar is not configured")
        return await self._post("/v1/customer-sessions/", payload)

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.base_url}{path}",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                },
            )
        response.raise_for_status()
        return response.json()

