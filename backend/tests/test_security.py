from app.core.security import hash_password, new_session_token, verify_password


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
