from datetime import datetime, timedelta

from tests.conftest import create_room, create_user, login


def test_list_rooms_includes_seeded(client, db):
    create_room(db, location="8F 회의실")
    create_room(db, location="14F 회의실")
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자",
    )
    assert login(client, email="user1@teamremited.com", password="User123!!imuserone").status_code == 204

    response = client.get("/rooms")
    assert response.status_code == 200
    locations = {room["location"] for room in response.json()}
    assert "8F 회의실" in locations
    assert "14F 회의실" in locations


def test_list_meetings_shows_created_meeting(client, db):
    create_room(db, location="8F 회의실")
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자",
    )
    assert login(client, email="user1@teamremited.com", password="User123!!imuserone").status_code == 204

    start_at = datetime.now() + timedelta(hours=4)
    meeting_payload = {
        "location": "8F 회의실",
        "title": "리스트 미팅",
        "start_at": start_at.isoformat(timespec="seconds"),
        "end_at": (start_at + timedelta(hours=1)).isoformat(timespec="seconds"),
    }
    create_response = client.post("/meetings", json=meeting_payload)
    assert create_response.status_code == 201

    response = client.get("/meetings/me")
    assert response.status_code == 200
    titles = {meeting["title"] for meeting in response.json()}
    assert "리스트 미팅" in titles


def test_drink_orders_me_returns_only_users_orders(client, db):
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
        json={"drink_name": "라떼", "product_url": "https://example.com/latte"},
    )
    assert create_response.status_code == 201
    client.post("/auth/logout")

    assert login(client, email="user2@teamremited.com", password="User123!!imuserone").status_code == 204
    response = client.get("/drink-orders/me")
    assert response.status_code == 200
    assert response.json() == []
