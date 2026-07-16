"""Health endpoint tests."""

from fastapi.testclient import TestClient

from app.core.config import settings


def test_liveness(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_liveness_no_auth_required(client: TestClient) -> None:
    """Health check must be accessible without any token."""
    r = client.get(f"{settings.API_V1_STR}/health")
    assert r.status_code == 200
