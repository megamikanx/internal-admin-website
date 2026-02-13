from app.core.config import SESSION_COOKIE_NAME
from tests.conftest import create_user


def test_login_sets_session_cookie(client, db):
    user = create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="User",
    )

    response = client.post(
        "/auth/login",
        json={"email": user.email, "password": "User123!!imuserone"},
    )

    assert response.status_code == 204
    set_cookie = response.headers.get("set-cookie", "")
    assert SESSION_COOKIE_NAME in set_cookie
