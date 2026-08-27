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
