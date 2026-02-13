from tests.conftest import create_user, login

def test_duplicate_location_returns_409(client, db):
    create_user(
        db,
        email="admin@teamremited.com",
        password="Admin123!!",
        nickname="admin",
        name="관리자",
        admin_status=True,
    )
    assert login(client, email="admin@teamremited.com", password="Admin123!!").status_code == 204

    response_a = client.post("/rooms", json={"location": "8F Meeting Room"})
    assert response_a.status_code == 201

    response_b = client.post("/rooms", json={"location": "8F Meeting Room"})
    assert response_b.status_code == 409


def test_duplicate_user_email_or_nickname_returns_409(client, db):
    create_user(
        db,
        email="admin@teamremited.com",
        password="Admin123!!",
        nickname="admin",
        name="관리자",
        admin_status=True,
    )
    assert login(client, email="admin@teamremited.com", password="Admin123!!").status_code == 204

    response_a = client.post(
        "/users",
        json={
            "email": "user1@teamremited.com",
            "name": "User",
            "nickname": "user1",
            "password": "User123!!",
            "team": "DEV",
        },
    )
    assert response_a.status_code == 201

    response_email = client.post(
        "/users",
        json={
            "email": "user1@teamremited.com",
            "name": "User2",
            "nickname": "user2",
            "password": "User123!!",
            "team": "DEV",
        },
    )
    assert response_email.status_code == 409

    response_nick = client.post(
        "/users",
        json={
            "email": "user2@teamremited.com",
            "name": "User3",
            "nickname": "user1",
            "password": "User123!!",
            "team": "DEV",
        },
    )
    assert response_nick.status_code == 409
