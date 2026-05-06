from __future__ import annotations

from typing import Any

import httpx


async def publish_to_linkedin(
    *,
    access_token: str,
    account_id: str,
    content: str,
) -> str:
    payload = {
        "author": f"urn:li:person:{account_id}",
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": content},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            },
        )
    if not response.is_success:
        try:
            error: dict[str, Any] = response.json()
        except ValueError:
            error = {"message": response.text}
        raise RuntimeError(str(error.get("message") or "LinkedIn API error"))
    return response.headers.get("x-restli-id") or response.json().get("id", "")
