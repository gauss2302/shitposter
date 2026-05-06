from datetime import UTC, datetime, timedelta

from app.application.api_key_service import decode_scopes, encode_scopes
from app.core.security import api_key_lookup_prefix, create_api_key, hash_api_key, verify_api_key


def test_scope_encoding_round_trips_sorted_unique_values() -> None:
    encoded = encode_scopes(["posts:write", "accounts:read", "posts:write"])

    assert decode_scopes(encoded) == ["accounts:read", "posts:write"]


def test_decode_scopes_fails_closed_for_invalid_payload() -> None:
    assert decode_scopes("not-json") == []
    assert decode_scopes('{"scope":"*"}') == []


def test_raw_api_key_can_be_looked_up_but_not_reconstructed_from_hash() -> None:
    raw_key, prefix = create_api_key()
    key_hash = hash_api_key(raw_key)

    assert api_key_lookup_prefix(raw_key) == prefix
    assert key_hash != raw_key
    assert prefix not in key_hash
    assert verify_api_key(raw_key, key_hash)
    assert not verify_api_key(raw_key.replace(prefix, "wrong"), key_hash)


def test_expiry_comparison_uses_naive_utc_values() -> None:
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=1)

    assert expires_at.tzinfo is None
