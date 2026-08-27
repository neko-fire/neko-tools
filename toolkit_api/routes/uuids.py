"""UUID generation API route."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from toolkit_api.features.uuid_generator import generate_uuid7_batch


INVALID_UUID_COUNT_MESSAGE = 'Choose a quantity between 1 and 100.'

router = APIRouter()


class UUIDGenerationRequest(BaseModel):
    count: int


@router.post('/api/uuids')
def generate_uuids(request: UUIDGenerationRequest) -> dict[str, list[str]]:
    try:
        return {'ids': generate_uuid7_batch(request.count)}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=INVALID_UUID_COUNT_MESSAGE) from error
