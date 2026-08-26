from zoneinfo import ZoneInfo

import pytest

import apps.time_zones as time_zones
from apps.time_zones import InvalidBrowserTimeZone, parse_browser_time_zone


def test_valid_iana_time_zone_is_resolved():
    assert parse_browser_time_zone('America/Los_Angeles') == ZoneInfo(
        'America/Los_Angeles'
    )


@pytest.mark.parametrize('value', [None, '', '   ', 42, 'x' * 256])
def test_invalid_values_are_rejected(value):
    with pytest.raises(InvalidBrowserTimeZone):
        parse_browser_time_zone(value)


def test_oversized_value_is_rejected_before_zoneinfo_lookup(monkeypatch):
    monkeypatch.setattr(time_zones, 'ZoneInfo', lambda key: pytest.fail(key))

    with pytest.raises(InvalidBrowserTimeZone):
        parse_browser_time_zone('x' * 256)
