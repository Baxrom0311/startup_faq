from fastapi.testclient import TestClient
from app.core.config import settings

def test_telegram_auth_rate_limit(client: TestClient) -> None:
    phone = "+998909998877"
    
    # Send 5 requests (should pass successfully)
    for _ in range(5):
        response = client.post(
            f"{settings.API_V1_STR}/auth/telegram/start",
            json={"phone": phone, "client": "web"},
        )
        assert response.status_code == 200
        
    # The 6th request within the same minute should be rate limited with 429
    response = client.post(
        f"{settings.API_V1_STR}/auth/telegram/start",
        json={"phone": phone, "client": "web"},
    )
    assert response.status_code == 429
    assert "Rate limit exceeded" in response.text
