from fastapi import APIRouter

from app.api.v1 import agent, ai, analytics, api_keys, auth, billing, dashboard, health, posts, social

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(agent.router)
api_router.include_router(ai.router)
api_router.include_router(api_keys.router)
api_router.include_router(analytics.router)
api_router.include_router(billing.router)
api_router.include_router(dashboard.router)
api_router.include_router(health.router, tags=["health"])
api_router.include_router(posts.router)
api_router.include_router(social.router)


@api_router.get("/ready", tags=["health"])
async def ready() -> dict[str, bool]:
    return {"ready": True}
