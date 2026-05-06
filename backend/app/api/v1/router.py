from fastapi import APIRouter

from app.api.v1 import auth, dashboard, health, posts, social

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(health.router, tags=["health"])
api_router.include_router(posts.router)
api_router.include_router(social.router)
