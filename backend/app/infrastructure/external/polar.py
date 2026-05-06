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

    async def create_checkout(
        self,
        *,
        user_id: str,
        email: str,
        name: str,
        product_id: str,
        success_url: str,
        return_url: str,
    ) -> dict[str, str]:
        if not self.configured:
            raise PolarNotConfiguredError("Polar is not configured")
        payload = {
            "products": [product_id],
            "successUrl": success_url,
            "returnUrl": return_url,
            "customerEmail": email,
            "customerName": name,
            "externalCustomerId": user_id,
            "metadata": {"userId": user_id},
        }
        response = await self._post("/v1/checkouts/", payload)
        return {"url": str(response.get("url", "")), "checkoutId": str(response.get("id", ""))}

    async def create_portal(self, *, user_id: str, return_url: str) -> dict[str, str]:
        if not self.configured:
            raise PolarNotConfiguredError("Polar is not configured")
        response = await self._post(
            "/v1/customer-sessions/",
            {"externalCustomerId": user_id, "returnUrl": return_url},
        )
        return {"url": str(response.get("customerPortalUrl", response.get("url", "")))}

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

