from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import hash_password, verify_password
from app.domain.exceptions import AuthenticationError, ConflictError
from app.infrastructure.db import models
from app.infrastructure.db.repositories import AccountRepository, SessionRepository, UserRepository


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    name: str
    email: str
    image: str | None


@dataclass(frozen=True)
class AuthResult:
    user: AuthenticatedUser
    session_token: str
    expires_at: datetime


def to_authenticated_user(user: models.User) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=user.id,
        name=user.name,
        email=user.email,
        image=user.image,
    )


class AuthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.users = UserRepository(session)
        self.accounts = AccountRepository(session)
        self.sessions = SessionRepository(session)

    async def sign_up(
        self,
        *,
        email: str,
        password: str,
        name: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResult:
        normalized_email = email.strip().lower()
        existing = await self.users.get_by_email(normalized_email)
        if existing is not None:
            raise ConflictError("Email is already registered")

        now = datetime.now(UTC).replace(tzinfo=None)
        user = await self.users.add(
            models.User(
                id=uuid4().hex,
                name=name.strip() or normalized_email,
                email=normalized_email,
                email_verified=False,
                created_at=now,
                updated_at=now,
            )
        )
        await self.accounts.add(
            models.Account(
                id=uuid4().hex,
                account_id=normalized_email,
                provider_id="credential",
                user_id=user.id,
                password=hash_password(password),
                created_at=now,
                updated_at=now,
            )
        )
        return await self._create_session(
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def sign_in(
        self,
        *,
        email: str,
        password: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResult:
        normalized_email = email.strip().lower()
        user = await self.users.get_by_email(normalized_email)
        if user is None:
            raise AuthenticationError("Invalid email or password")

        account = await self.accounts.get_credentials_account(user.id)
        if account is None or not account.password:
            raise AuthenticationError("Invalid email or password")
        if not verify_password(password, account.password):
            raise AuthenticationError("Invalid email or password")

        return await self._create_session(
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def get_user_for_session(self, session_token: str | None) -> AuthenticatedUser | None:
        if not session_token:
            return None
        session = await self.sessions.get_by_token(session_token)
        if session is None:
            return None
        now = datetime.now(UTC).replace(tzinfo=None)
        if session.expires_at <= now:
            await self.sessions.delete_by_token(session_token)
            return None
        user = await self.users.get_by_id(session.user_id)
        return to_authenticated_user(user) if user else None

    async def sign_out(self, session_token: str | None) -> None:
        if session_token:
            await self.sessions.delete_by_token(session_token)

    async def _create_session(
        self,
        *,
        user: models.User,
        ip_address: str | None,
        user_agent: str | None,
    ) -> AuthResult:
        now = datetime.now(UTC).replace(tzinfo=None)
        expires_at = now + timedelta(days=self.settings.session_days)
        session_token = token_urlsafe(48)
        await self.sessions.add(
            models.Session(
                id=uuid4().hex,
                token=session_token,
                user_id=user.id,
                expires_at=expires_at,
                ip_address=ip_address,
                user_agent=user_agent,
                created_at=now,
                updated_at=now,
            )
        )
        return AuthResult(
            user=to_authenticated_user(user),
            session_token=session_token,
            expires_at=expires_at,
        )
