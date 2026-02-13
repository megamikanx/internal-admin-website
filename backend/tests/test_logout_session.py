from tests.conftest import create_user, login


def test_logout_invalidates_session(client, db):
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자",
    )

    login_response = login(client, email="user1@teamremited.com", password="User123!!imuserone")
    assert login_response.status_code == 204

    assert client.get("/meetings/me").status_code == 200

    logout_response = client.post("/auth/logout")
    assert logout_response.status_code == 204

    assert client.get("/meetings/me").status_code == 401
