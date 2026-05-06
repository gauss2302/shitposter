from app.infrastructure.db import models  # noqa: F401
from app.infrastructure.db.base import Base


def test_models_match_existing_table_names() -> None:
    expected = {
        "account",
        "ai_provider_credential",
        "api_key",
        "post",
        "post_target",
        "session",
        "social_account",
        "subscription",
        "user",
        "verification",
    }

    assert expected.issubset(Base.metadata.tables.keys())


def test_social_account_columns_include_oauth1_credentials() -> None:
    social_account = Base.metadata.tables["social_account"]

    assert "oauth1_access_token" in social_account.columns
    assert "access_token_secret" in social_account.columns
