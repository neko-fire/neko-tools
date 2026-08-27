from fastapi.testclient import TestClient

from toolkit_api.main import create_app


def test_health():
    assert TestClient(create_app()).get('/api/health').json() == {'status': 'ok'}


def test_uuid_endpoint_returns_requested_number_of_ids():
    response = TestClient(create_app()).post('/api/uuids', json={'count': 3})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload['ids']) == 3


def test_uuid_endpoint_rejects_zero_with_recovery_message():
    response = TestClient(create_app()).post('/api/uuids', json={'count': 0})

    assert response.status_code == 422
    assert 'between 1 and 100' in response.json()['detail']


def test_static_stylesheet_is_available_at_the_page_asset_url():
    response = TestClient(create_app()).get('/static/styles.css')

    assert response.status_code == 200
    assert response.headers['content-type'].startswith('text/css')


def test_root_serves_the_toolkit_page():
    response = TestClient(create_app()).get('/')

    assert response.status_code == 200
    assert 'Timestamp converter' in response.text
    assert 'UUIDv7 generator' in response.text


def test_feature_manifest_lists_both_browser_tools():
    response = TestClient(create_app()).get('/api/features')

    assert response.status_code == 200
    assert [feature['id'] for feature in response.json()['features']] == [
        'time_converter',
        'uuid_generator',
    ]
