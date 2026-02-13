from datetime import datetime, timedelta

from tests.conftest import create_room, create_user, login


def test_invalid_email_domain_returns_422(client, db):
    create_user(
        db,
        email="admin@teamremited.com",
        password="Admin123!!",
        nickname="admin",
        name="관리자",
        admin_status=True,
    )
    assert login(client, email="admin@teamremited.com", password="Admin123!!").status_code == 204

    response = client.post(
        "/users",
        json={
            "email": "bad@notremited.com",
            "name": "사용자",
            "nickname": "baduser",
            "password": "User123!!",
        },
    )
    assert response.status_code == 422


def test_invalid_password_regex_returns_422(client, db):
    create_user(
        db,
        email="admin@teamremited.com",
        password="Admin123!!",
        nickname="admin",
        name="관리자",
        admin_status=True,
    )
    assert login(client, email="admin@teamremited.com", password="Admin123!!").status_code == 204

    response = client.post(
        "/users",
        json={
            "email": "user2@teamremited.com",
            "name": "사용자",
            "nickname": "badpw",
            "password": "bad✈️",
        },
    )
    assert response.status_code == 422


def test_meeting_end_before_start_returns_422(client, db):
    create_room(db, location="8F 회의실")
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자",
    )
    assert login(client, email="user1@teamremited.com", password="User123!!imuserone").status_code == 204

    start_at = datetime.now() + timedelta(hours=2)
    response = client.post(
        "/meetings",
        json={
            "location": "8F 회의실",
            "title": "잘못된 미팅",
            "start_at": start_at.isoformat(timespec="seconds"),
            "end_at": (start_at - timedelta(minutes=10)).isoformat(timespec="seconds"),
        },
    )
    assert response.status_code == 422


def test_drink_order_invalid_url_returns_422(client, db):
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자",
    )
    assert login(client, email="user1@teamremited.com", password="User123!!imuserone").status_code == 204

    response = client.post(
        "/drink-orders",
        json={"drink_name": "아메리카노", "product_url": "not-a-url"},
    )
    assert response.status_code == 422
