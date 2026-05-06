from app.core.security import (
    api_key_lookup_prefix,
    create_api_key,
    hash_api_key,
    hash_password,
    new_session_token,
    verify_api_key,
    verify_password,
)


def test_password_hash_round_trip() -> None:
    hashed = hash_password("correct horse battery staple")

    assert hashed != "correct horse battery staple"
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong password", hashed)


def test_session_tokens_are_urlsafe_and_unique() -> None:
    one = new_session_token()
    two = new_session_token()

    assert one != two
    assert len(one) >= 40
    assert len(two) >= 40


def test_api_keys_have_lookup_prefix_and_hash_verification() -> None:
    raw_key, prefix = create_api_key()

    assert raw_key.startswith("sp_live_")
    assert api_key_lookup_prefix(raw_key) == prefix
    hashed = hash_api_key(raw_key)
    assert hashed != raw_key
    assert verify_api_key(raw_key, hashed)
    assert not verify_api_key(raw_key + "x", hashed)
