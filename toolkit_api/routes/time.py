"""Timestamp conversion API route."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from toolkit_api.features.time_converter import UnknownTimezoneError, convert_timestamp


INVALID_TIMESTAMP_MESSAGE = 'Enter an ISO date/time or Unix timestamp in seconds or milliseconds.'
UNKNOWN_TIMEZONE_MESSAGE = 'Select a different display time zone.'

router = APIRouter()


class TimestampConversionRequest(BaseModel):
    value: str
    local_timezone: str | None = None


@router.post('/api/convert')
def convert(request: TimestampConversionRequest) -> dict[str, str | int]:
    try:
        return convert_timestamp(request.value, request.local_timezone)
    except UnknownTimezoneError as error:
        raise HTTPException(status_code=422, detail=UNKNOWN_TIMEZONE_MESSAGE) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=INVALID_TIMESTAMP_MESSAGE) from error
