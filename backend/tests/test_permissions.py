from tests.conftest import create_user


def test_normal_user_blocked_from_admin_endpoint(client, db):
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자",
    )

    login_response = client.post(
        "/auth/login",
        json={"email": "user1@teamremited.com", "password": "User123!!imuserone"},
    )
    assert login_response.status_code == 204

    response = client.post(
        "/rooms",
        json={"location": "테스트 회의실"},
    )
    assert response.status_code == 403
