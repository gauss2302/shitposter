import base64
import hmac
from hashlib import sha256
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.billing_service import BillingService
from app.core.config import Settings


def test_polar_standard_webhook_signature_verifies() -> None:
    body = b'{"type":"subscription.updated","data":{}}'
    webhook_id = "msg_123"
    webhook_timestamp = "1730000000"
    key = b"test-secret"
    signed = b".".join([webhook_id.encode(), webhook_timestamp.encode(), body])
    signature = base64.b64encode(hmac.new(key, signed, sha256).digest()).decode()
    settings = Settings(polar_webhook_secret=base64.b64encode(key).decode())
    service = BillingService(cast(AsyncSession, object()), settings)

    assert service._verify_standard_webhook_signature(
        body,
        f"v1,{signature}",
        webhook_id=webhook_id,
        webhook_timestamp=webhook_timestamp,
    )
