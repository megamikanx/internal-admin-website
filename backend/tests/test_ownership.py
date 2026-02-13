from datetime import datetime, timedelta

from tests.conftest import create_room, create_user, login


def test_user_cannot_cancel_other_users_meeting(client, db):
    create_room(db, location="8F 회의실")
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자1",
    )
    create_user(
        db,
        email="user2@teamremited.com",
        password="User123!!imuserone",
        nickname="user2",
        name="사용자2",
    )

    assert login(client, email="user1@teamremited.com", password="User123!!imuserone").status_code == 204
    start_at = datetime.now() + timedelta(hours=3)
    meeting_payload = {
        "location": "8F 회의실",
        "title": "사용자1 미팅",
        "start_at": start_at.isoformat(timespec="seconds"),
        "end_at": (start_at + timedelta(hours=1)).isoformat(timespec="seconds"),
    }
    create_response = client.post("/meetings", json=meeting_payload)
    assert create_response.status_code == 201

    client.post("/auth/logout")
    assert login(client, email="user2@teamremited.com", password="User123!!imuserone").status_code == 204

    cancel_response = client.post(
        "/meetings/cancel",
        json={"location": "8F 회의실", "start_at": start_at.isoformat(timespec="seconds")},
    )
    assert cancel_response.status_code == 403


def test_user_cannot_see_others_drink_orders(client, db):
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자1",
    )
    create_user(
        db,
        email="user2@teamremited.com",
        password="User123!!imuserone",
        nickname="user2",
        name="사용자2",
    )

    assert login(client, email="user1@teamremited.com", password="User123!!imuserone").status_code == 204
    create_response = client.post(
        "/drink-orders",
        json={"drink_name": "아메리카노", "product_url": "https://example.com/coffee"},
    )
    assert create_response.status_code == 201
    client.post("/auth/logout")

    assert login(client, email="user2@teamremited.com", password="User123!!imuserone").status_code == 204
    response = client.get("/drink-orders/me")
    assert response.status_code == 200
    assert response.json() == []
