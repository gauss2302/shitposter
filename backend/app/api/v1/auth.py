from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session, get_settings
from app.application.auth_service import AuthenticatedUser, AuthService
from app.core.config import Settings
from app.domain.exceptions import AuthenticationError, ConflictError

router = APIRouter(prefix="/auth", tags=["auth"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


class SignUpRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=1024)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    image: str | None = None


class SessionResponse(BaseModel):
    user: UserResponse | None


def _set_session_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        domain=settings.session_cookie_domain,
        path="/",
    )


def _clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        settings.session_cookie_name,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        domain=settings.session_cookie_domain,
        path="/",
    )


def _to_response(authenticated: AuthenticatedUser) -> SessionResponse:
    return SessionResponse(
        user=UserResponse(
            id=authenticated.user.id,
            name=authenticated.user.name,
            email=authenticated.user.email,
            image=authenticated.user.image,
        )
    )


@router.post("/sign-up", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def sign_up(
    payload: SignUpRequest,
    request: Request,
    response: Response,
    db: DbSessionDep,
    settings: SettingsDep,
) -> SessionResponse:
    service = AuthService(db, settings)
    try:
        authenticated = await service.sign_up(
            name=payload.name,
            email=payload.email,
            password=payload.password,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    await db.commit()
    _set_session_cookie(response, settings, authenticated.session_token)
    return _to_response(authenticated)


@router.post("/sign-in", response_model=SessionResponse)
async def sign_in(
    payload: SignInRequest,
    request: Request,
    response: Response,
    db: DbSessionDep,
    settings: SettingsDep,
) -> SessionResponse:
    service = AuthService(db, settings)
    try:
        authenticated = await service.sign_in(
            email=payload.email,
            password=payload.password,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    await db.commit()
    _set_session_cookie(response, settings, authenticated.session_token)
    return _to_response(authenticated)


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT)
async def sign_out(
    request: Request,
    response: Response,
    db: DbSessionDep,
    settings: SettingsDep,
) -> None:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        await AuthService(db, settings).sign_out(token)
        await db.commit()
    _clear_session_cookie(response, settings)


@router.get("/session", response_model=SessionResponse)
async def get_session(
    request: Request,
    db: DbSessionDep,
    settings: SettingsDep,
) -> SessionResponse:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return SessionResponse(user=None)
    authenticated = await AuthService(db, settings).get_authenticated_user(token)
    if authenticated is None:
        return SessionResponse(user=None)
    return _to_response(authenticated)
