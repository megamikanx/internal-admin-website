from tests.conftest import create_room, create_user, login


def test_smoke_unauthorized_endpoints_require_login(client):
    assert client.get("/rooms").status_code == 401
    assert client.get("/meetings/me").status_code == 401
    assert client.get("/drink-orders/me").status_code == 401


def test_smoke_authorized_normal_user_endpoints(client, db):
    create_room(db, location="8F 회의실")
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자",
    )

    login_response = login(client, email="user1@teamremited.com", password="User123!!imuserone")
    assert login_response.status_code == 204

    assert client.get("/rooms").status_code == 200
    assert client.get("/meetings/me").status_code == 200
    assert client.get("/drink-orders/me").status_code == 200


def test_smoke_authorized_admin_endpoints(client, db):
    create_user(
        db,
        email="admin@teamremited.com",
        password="Admin123!!",
        nickname="admin",
        name="관리자",
        admin_status=True,
    )

    login_response = login(client, email="admin@teamremited.com", password="Admin123!!")
    assert login_response.status_code == 204

    response = client.post("/rooms", json={"location": "관리자 회의실"})
    assert response.status_code == 201
