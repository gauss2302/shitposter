"""Public REST API router — mounted at ``/api/public/v1``.

Separate from the dashboard cookie API so the public surface (rate limits,
plan gating, OpenAPI tags) can evolve independently.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.public.v1 import accounts, ai, capabilities, me, posts

public_v1_router = APIRouter()
public_v1_router.include_router(me.router)
public_v1_router.include_router(capabilities.router)
public_v1_router.include_router(accounts.router)
public_v1_router.include_router(posts.router)
public_v1_router.include_router(ai.router)
