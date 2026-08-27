"""UUIDv7 batch generation."""

from uuid6 import uuid7


def generate_uuid7_batch(count: int) -> list[str]:
    """Generate a batch of between one and one hundred UUIDv7 values."""
    if not 1 <= count <= 100:
        raise ValueError('Choose a quantity between 1 and 100.')
    return [str(uuid7()) for _ in range(count)]
