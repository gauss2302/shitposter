"""Capability matrix — pure serializer test (no auth / no DB)."""

from __future__ import annotations

from app.api.public.v1.serializers import all_capabilities
from app.application.posts_service import SUPPORTED_PUBLISHING_PLATFORMS


def test_capabilities_include_all_four_publishing_platforms() -> None:
    caps = {cap.platform: cap for cap in all_capabilities()}

    for platform in SUPPORTED_PUBLISHING_PLATFORMS:
        assert platform in caps, f"{platform} missing from capabilities"
        assert caps[platform].publishSupported is True
        assert caps[platform].notes is None  # only stale notes mark unsupported


def test_capabilities_expose_text_limits_for_known_platforms() -> None:
    caps = {cap.platform: cap for cap in all_capabilities()}

    assert caps["twitter"].textLimit == 280
    assert caps["linkedin"].textLimit == 3000
    assert caps["tiktok"].textLimit == 2200
    assert caps["instagram"].textLimit == 2200


def test_capabilities_flag_media_support_per_platform() -> None:
    caps = {cap.platform: cap for cap in all_capabilities()}

    assert caps["twitter"].mediaSupported is True
    assert caps["tiktok"].mediaSupported is True
    assert caps["instagram"].mediaSupported is True
    # LinkedIn adapter publishes text only — keep the contract honest.
    assert caps["linkedin"].mediaSupported is False
