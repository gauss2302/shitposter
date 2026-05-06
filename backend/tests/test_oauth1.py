from app.infrastructure.external.twitter_oauth1 import create_oauth1_header


def test_oauth1_header_contains_expected_parameters() -> None:
    header = create_oauth1_header(
        "POST",
        "https://api.x.com/oauth/request_token",
        {"oauth_callback": "https://example.com/callback"},
        consumer_key="client-id",
        consumer_secret="client-secret",
    )

    assert header.startswith("OAuth ")
    assert 'oauth_consumer_key="client-id"' in header
    assert 'oauth_signature_method="HMAC-SHA1"' in header
    assert "oauth_signature=" in header
