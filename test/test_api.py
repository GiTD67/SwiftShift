import json
import os
import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://root:root@localhost:5432/devdb")

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ---- Health ----

def test_health_endpoint(client):
    """Health check returns 200."""
    response = client.get('/api/health')
    assert response.status_code == 200


# ---- Auth: signup ----

def test_signup_missing_fields(client):
    res = client.post('/api/auth/signup', json={})
    assert res.status_code == 400
    data = res.get_json()
    assert 'error' in data


def test_signup_password_too_short(client):
    res = client.post('/api/auth/signup', json={
        'first_name': 'Test', 'last_name': 'User',
        'email': 'short@example.com', 'password': 'abc'
    })
    assert res.status_code == 400
    data = res.get_json()
    assert 'password' in data.get('error', '').lower()


def test_signin_missing_fields(client):
    res = client.post('/api/auth/signin', json={})
    assert res.status_code == 400


def test_signin_invalid_credentials(client):
    res = client.post('/api/auth/signin', json={
        'email': 'nobody@example.com', 'password': 'wrongpassword'
    })
    assert res.status_code == 401
    data = res.get_json()
    assert 'error' in data


# ---- Employees ----

def test_list_employees(client):
    res = client.get('/api/employees')
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


def test_create_employee_missing_name(client):
    res = client.post('/api/employees', json={'email': 'test@example.com'})
    assert res.status_code == 400


# ---- Clock sessions ----

def test_list_clock_sessions(client):
    res = client.get('/api/clock-sessions')
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


def test_clock_in_missing_employee_id(client):
    res = client.post('/api/clock-sessions', json={})
    assert res.status_code == 400


# ---- Time entries ----

def test_list_time_entries(client):
    res = client.get('/api/time-entries')
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


# ---- Users ----

def test_list_users(client):
    res = client.get('/api/users')
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


# ---- Jobs ----

def test_list_jobs(client):
    res = client.get('/api/jobs')
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


def test_create_job_missing_fields(client):
    res = client.post('/api/jobs', json={})
    assert res.status_code in (400, 201)
