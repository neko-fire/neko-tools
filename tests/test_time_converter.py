from fastapi.testclient import TestClient

from toolkit_api.main import create_app
from toolkit_api.features.time_converter import convert_timestamp


def test_epoch_seconds_are_normalized():
    result = convert_timestamp('0', 'UTC')

    assert result['utc_iso'] == '1970-01-01T00:00:00Z'
    assert result['unix_seconds'] == result['unix_milliseconds'] == 0


def test_iso_input_becomes_unix_seconds():
    assert convert_timestamp('2024-01-01T00:00:00Z', 'UTC')['unix_seconds'] == 1704067200


def test_invalid_input_is_actionable():
    response = TestClient(create_app()).post('/api/convert', json={'value': 'not-a-date'})

    assert response.status_code == 422
    assert 'ISO date/time' in response.json()['detail']


def test_invalid_local_timezone_has_the_recovery_focused_error():
    response = TestClient(create_app()).post(
        '/api/convert',
        json={'value': '0', 'local_timezone': 'Not/AZone'},
    )

    assert response.status_code == 422
    assert response.json()['detail'] == (
        'Enter an ISO date/time or Unix timestamp in seconds or milliseconds.'
    )
