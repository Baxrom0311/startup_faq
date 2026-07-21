"""Broadcast endpoint tests."""

import uuid
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Broadcast


def test_broadcasts_endpoints_require_superuser(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    # Create requires superuser
    r = client.post(
        f"{settings.API_V1_STR}/broadcasts/",
        headers=normal_user_token_headers,
        json={"title": "Test Title", "text_uz": "Uzbek content"},
    )
    assert r.status_code == 400 or r.status_code == 403

    # Read all requires superuser
    r = client.get(
        f"{settings.API_V1_STR}/broadcasts/",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 400 or r.status_code == 403


def test_create_and_read_broadcast(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # Create broadcast
    payload = {
        "title": "Ad Title",
        "text_uz": "Uzbek Matni",
        "text_ru": "Russian text",
        "text_en": "English text",
        "buttons": [{"text": "Click me", "url": "https://google.com"}],
        "target_region_id": None,
    }
    r = client.post(
        f"{settings.API_V1_STR}/broadcasts/",
        headers=superuser_token_headers,
        json=payload,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Ad Title"
    assert data["text_uz"] == "Uzbek Matni"
    assert len(data["buttons"]) == 1
    assert data["status"] == "pending"
    broadcast_id = data["id"]

    # Read specific broadcast
    r = client.get(
        f"{settings.API_V1_STR}/broadcasts/{broadcast_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Ad Title"

    # Read all broadcasts
    r = client.get(
        f"{settings.API_V1_STR}/broadcasts/",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    res = r.json()
    assert res["count"] >= 1
    titles = [b["title"] for b in res["data"]]
    assert "Ad Title" in titles


def test_update_broadcast(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # Setup
    broadcast = Broadcast(
        title="To Edit",
        text_uz="Old Uz Text",
        status="pending",
    )
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)

    # Patch title
    r = client.patch(
        f"{settings.API_V1_STR}/broadcasts/{broadcast.id}",
        headers=superuser_token_headers,
        json={"title": "Edited Title"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Edited Title"
    assert r.json()["text_uz"] == "Old Uz Text"


def test_update_non_pending_broadcast(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # Setup completed broadcast
    broadcast = Broadcast(
        title="Completed Broadcast",
        text_uz="Text",
        status="completed",
    )
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)

    # Patching must fail
    r = client.patch(
        f"{settings.API_V1_STR}/broadcasts/{broadcast.id}",
        headers=superuser_token_headers,
        json={"title": "Trying to edit"},
    )
    assert r.status_code == 400
    assert "Cannot update a broadcast that has already started" in r.json()["detail"]


def test_send_broadcast(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # Setup broadcast
    broadcast = Broadcast(
        title="Send me",
        text_uz="Text to send",
        status="pending",
    )
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)

    # Trigger sending
    r = client.post(
        f"{settings.API_V1_STR}/broadcasts/{broadcast.id}/send",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["message"] == "Broadcast sending enqueued in background"


def test_delete_broadcast(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    # Setup
    broadcast = Broadcast(
        title="To Delete",
        text_uz="Text to delete",
        status="pending",
    )
    db.add(broadcast)
    db.commit()
    db.refresh(broadcast)

    # Delete
    r = client.delete(
        f"{settings.API_V1_STR}/broadcasts/{broadcast.id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["message"] == "Broadcast deleted successfully"

    # Verify deleted
    from sqlmodel import select
    db_broadcast = db.exec(select(Broadcast).where(Broadcast.id == broadcast.id)).first()
    assert db_broadcast is None
