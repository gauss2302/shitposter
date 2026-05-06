from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ai_service import AiService
from app.core.config import Settings


def test_ai_candidate_reports_platform_limit_warnings() -> None:
    service = AiService(cast(AsyncSession, object()), Settings())
    candidate = service._candidate("x" * 301, ["twitter", "linkedin"])

    assert candidate.char_count == 301
    assert candidate.platform_fit["twitter"] is False
    assert candidate.platform_fit["linkedin"] is True
    assert candidate.warnings == [
        "Content is 21 characters over the twitter limit.",
    ]
