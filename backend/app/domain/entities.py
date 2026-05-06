from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    id: str
    name: str
    email: str
    image: str | None = None


@dataclass(frozen=True, slots=True)
class SubscriptionState:
    plan: str
    limit_per_platform: int | None
    status: str
    current_period_end: datetime | None
    cancel_at_period_end: bool
