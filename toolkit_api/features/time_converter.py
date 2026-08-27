"""Timestamp parsing and display formatting."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def convert_timestamp(value: str, local_timezone: str | None = None) -> dict[str, str | int]:
    """Normalize ISO inputs and Unix seconds/milliseconds to display fields."""
    utc_datetime = _parse_timestamp(value)
    try:
        local_datetime = utc_datetime.astimezone(ZoneInfo(local_timezone or 'UTC'))
    except ZoneInfoNotFoundError as error:
        raise ValueError('Timezone is not recognized.') from error

    return {
        'utc_iso': _format_iso(utc_datetime),
        'local_time': _format_iso(local_datetime),
        'unix_seconds': int(utc_datetime.timestamp()),
        'unix_milliseconds': int(utc_datetime.timestamp() * 1000),
        'relative_time': _relative_time(utc_datetime),
    }


def _parse_timestamp(value: str) -> datetime:
    cleaned_value = value.strip()
    if not cleaned_value:
        raise ValueError('Timestamp value is required.')

    try:
        numeric_value = float(cleaned_value)
    except ValueError:
        numeric_value = None

    if numeric_value is not None:
        seconds = numeric_value if abs(numeric_value) < 100000000000 else numeric_value / 1000
        try:
            return datetime.fromtimestamp(seconds, UTC)
        except (OverflowError, OSError, ValueError) as error:
            raise ValueError('Timestamp is outside the supported range.') from error

    iso_value = cleaned_value[:-1] + '+00:00' if cleaned_value.endswith('Z') else cleaned_value
    try:
        parsed = datetime.fromisoformat(iso_value)
    except ValueError as error:
        raise ValueError('Timestamp is not a valid ISO date/time.') from error
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def _format_iso(value: datetime) -> str:
    timespec = 'seconds' if value.microsecond == 0 else 'milliseconds'
    return value.isoformat(timespec=timespec).replace('+00:00', 'Z')


def _relative_time(value: datetime) -> str:
    seconds = int((value - datetime.now(UTC)).total_seconds())
    if abs(seconds) < 60:
        return 'just now' if seconds <= 0 else 'in a few seconds'

    quantity, unit = _relative_unit(seconds)
    suffix = '' if quantity == 1 else 's'
    return f'in {quantity} {unit}{suffix}' if seconds > 0 else f'{quantity} {unit}{suffix} ago'


def _relative_unit(seconds: int) -> tuple[int, str]:
    absolute_seconds = abs(seconds)
    for divisor, unit in ((86400, 'day'), (3600, 'hour'), (60, 'minute')):
        if absolute_seconds >= divisor:
            return absolute_seconds // divisor, unit
    return absolute_seconds, 'second'
