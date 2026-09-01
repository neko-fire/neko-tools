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


def test_local_time_is_rendered_in_the_requested_zone():
    result = convert_timestamp('1700000000', 'Europe/Berlin')

    assert result['local_time'] == '2023-11-14T23:13:20+01:00'
    assert result['utc_iso'] == '2023-11-14T22:13:20Z'


def test_invalid_local_timezone_names_the_time_zone_not_the_timestamp():
    response = TestClient(create_app()).post(
        '/api/convert',
        json={'value': '0', 'local_timezone': 'Not/AZone'},
    )

    assert response.status_code == 422
    assert response.json()['detail'] == 'Select a different display time zone.'


def test_rejected_time_zone_key_is_reported_as_a_time_zone_problem():
    response = TestClient(create_app()).post(
        '/api/convert',
        json={'value': '0', 'local_timezone': '/etc/localtime'},
    )

    assert response.status_code == 422
    assert response.json()['detail'] == 'Select a different display time zone.'
