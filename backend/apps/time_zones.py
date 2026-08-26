from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

MAX_TIME_ZONE_LENGTH = 255


class InvalidBrowserTimeZone(Exception):
    pass


def parse_browser_time_zone(value: object) -> ZoneInfo:
    if not isinstance(value, str):
        raise InvalidBrowserTimeZone

    key = value.strip()
    if not key or len(key) > MAX_TIME_ZONE_LENGTH:
        raise InvalidBrowserTimeZone

    try:
        return ZoneInfo(key)
    except (OSError, TypeError, ValueError, ZoneInfoNotFoundError) as exc:
        raise InvalidBrowserTimeZone from exc
