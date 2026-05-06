from functools import lru_cache
from typing import Annotated

from pydantic import AnyHttpUrl, Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the FastAPI backend.

    The backend is the only service that should require database, Redis,
    OAuth, billing, and token encryption secrets. The Next.js app should use
    only public frontend settings and `NEXT_PUBLIC_API_BASE_URL`.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", ".env.production"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    service_name: str = "shitposter-backend"
    version: str = "0.1.0"
    enable_docs: bool = True
    environment: str = Field(default="development", alias="NODE_ENV")
    api_v1_prefix: str = "/api/v1"

    database_url: PostgresDsn | str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5444/socialposter"
    )
    database_pool_size: int = 5
    database_max_overflow: int = 10
    redis_url: RedisDsn | str = "redis://localhost:6344/0"

    frontend_public_url: AnyHttpUrl | str = "http://localhost:3000"
    backend_public_url: AnyHttpUrl | str = "http://localhost:8000"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    session_cookie_name: str = "shitposter_session"
    session_cookie_domain: str | None = None
    session_cookie_secure: bool = False
    session_cookie_samesite: Annotated[str, Field(pattern="^(lax|strict|none)$")] = "lax"
    session_days: int = 7

    token_encryption_key: str = "development-token-encryption-key"
    password_hash_scheme: str = "bcrypt"

    google_client_id: str = ""
    google_client_secret: str = ""
    twitter_client_id: str = ""
    twitter_client_secret: str = ""
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""

    polar_access_token: str = ""
    polar_server_url: str = ""
    polar_webhook_secret: str = ""
    polar_product_id_basic: str = ""
    polar_product_id_business: str = ""
    polar_product_id_enterprise: str = ""

    sentry_dsn: str = ""
    sentry_environment: str = ""

    log_level: str = "info"
    log_format: Annotated[str, Field(pattern="^(text|json)$")] = "text"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("database_url", mode="after")
    @classmethod
    def normalize_database_url(cls, value: PostgresDsn | str) -> str:
        url = str(value)
        # Docker/legacy envs often use the sync URL scheme. SQLAlchemy async
        # engines require the asyncpg driver suffix.
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
