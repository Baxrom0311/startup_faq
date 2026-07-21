from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.crud import get_user_by_email
from app.models import Notification


def test_notifications_lifecycle(
    client: TestClient, db: Session, normal_user_token_headers
) -> None:
    user = get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    assert user is not None
    headers = normal_user_token_headers
    
    # 1. Create a mock notification
    notification = Notification(
        user_id=user.id,
        type="test.alert",
        payload={"message": "Hello!"},
    )
    db.add(notification)
    db.commit()
    
    # 2. Read notifications
    r = client.get(f"{settings.API_V1_STR}/notifications", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    assert data["unread_count"] >= 1
    # Check that our created notification is in the list
    assert any(n["type"] == "test.alert" for n in data["data"])
    
    # 3. Stream notifications (SSE)
    # We pass token via query parameter since SSE uses query parameters
    token = headers["Authorization"].split(" ")[1]
    
    with client.stream("GET", f"{settings.API_V1_STR}/notifications/stream?token={token}&test_once=true") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        # Read the first event chunk
        for chunk in response.iter_lines():
            if chunk:
                assert "unread_count" in chunk
                break

    # 4. Mark notifications read
    r_read = client.post(
        f"{settings.API_V1_STR}/notifications/read",
        headers=headers,
        json={"notification_ids": [str(notification.id)]},
    )
    assert r_read.status_code == 200
    
    # Verify unread count is 0
    r = client.get(f"{settings.API_V1_STR}/notifications", headers=headers)
    assert r.status_code == 200
    assert r.json()["unread_count"] == 0
