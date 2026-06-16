from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app.application.recipe_service import (
    FREQUENCY_DELTAS,
    _parse_json_list,
    _parse_json_object,
    advance_next_run,
)
from app.domain.exceptions import ValidationError


def test_advance_next_run_hourly() -> None:
    anchor = datetime(2026, 5, 9, 12, 30, 0)
    assert advance_next_run(frequency="hourly", anchor=anchor) == datetime(
        2026, 5, 9, 13, 30, 0
    )


def test_advance_next_run_daily() -> None:
    anchor = datetime(2026, 5, 9, 12, 0, 0)
    assert advance_next_run(frequency="daily", anchor=anchor) == datetime(
        2026, 5, 10, 12, 0, 0
    )


def test_advance_next_run_every_15min() -> None:
    anchor = datetime(2026, 5, 9, 12, 0, 0)
    assert advance_next_run(frequency="every_15min", anchor=anchor) == datetime(
        2026, 5, 9, 12, 15, 0
    )


def test_advance_next_run_rejects_unknown_frequency() -> None:
    with pytest.raises(ValidationError):
        advance_next_run(frequency="every_fortnight", anchor=datetime(2026, 5, 9))


def test_frequency_deltas_cover_expected_set() -> None:
    expected = {
        "every_15min",
        "every_30min",
        "hourly",
        "every_2h",
        "every_6h",
        "every_12h",
        "daily",
    }
    assert set(FREQUENCY_DELTAS) == expected
    # Each delta is positive
    for value in FREQUENCY_DELTAS.values():
        assert value > timedelta(0)


def test_parse_json_object_handles_none() -> None:
    assert _parse_json_object(None) == {}


def test_parse_json_object_handles_invalid_json() -> None:
    assert _parse_json_object("not json") == {}


def test_parse_json_object_handles_non_object_json() -> None:
    assert _parse_json_object("[1,2,3]") == {}


def test_parse_json_object_returns_dict() -> None:
    assert _parse_json_object('{"a": 1, "b": "x"}') == {"a": 1, "b": "x"}


def test_parse_json_list_handles_none() -> None:
    assert _parse_json_list(None) == []


def test_parse_json_list_coerces_to_strings() -> None:
    assert _parse_json_list('["abc", 42, true]') == ["abc", "42", "True"]


def test_parse_json_list_rejects_non_list() -> None:
    assert _parse_json_list('{"a": 1}') == []
