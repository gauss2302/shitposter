from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.application.analytics_service import AnalyticsService
from app.application.auth_service import AuthenticatedUser
from app.domain.exceptions import AuthenticationError, NotFoundError, RateLimitError

router = APIRouter(prefix="/analytics", tags=["analytics"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


@router.get("/twitter/{account_id}")
async def twitter_analytics(
    account_id: str,
    current: CurrentUserDep,
    db: DbSessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict:
    try:
        return await AnalyticsService(db).get_twitter_analytics(
            user_id=current.user.id,
            account_id=account_id,
            tweet_limit=limit,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": "900"},
        ) from exc
    except AuthenticationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
