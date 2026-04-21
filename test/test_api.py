import pytest
from app import app


def test_health_endpoint():
    """Test that /api/health returns 200 to confirm the API is live."""
    client = app.test_client()
    response = client.get('/api/health')
    assert response.status_code == 200
