import uuid

import pytest

from toolkit_api.features.uuid_generator import generate_uuid7_batch


def test_batch_is_requested_size_and_version_seven():
    values = generate_uuid7_batch(3)

    assert len(values) == 3
    assert all(uuid.UUID(item).version == 7 for item in values)


def test_invalid_batch_size_is_rejected():
    with pytest.raises(ValueError, match="between 1 and 100"):
        generate_uuid7_batch(101)
