from app.infrastructure.crypto import decrypt, encrypt


def test_token_crypto_round_trip_uses_legacy_hex_envelope() -> None:
    encrypted = encrypt("super-secret-token")

    assert encrypted != "super-secret-token"
    # Legacy TypeScript format: 16-byte IV + 16-byte auth tag + ciphertext, hex encoded.
    assert len(encrypted) > 64
    int(encrypted, 16)
    assert decrypt(encrypted) == "super-secret-token"
