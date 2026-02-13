from tests.conftest import create_user


def test_drink_order_transitions(client, db):
    create_user(
        db,
        email="admin@teamremited.com",
        password="Admin123!!",
        nickname="admin",
        name="Admin",
        admin_status=True,
    )
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="User",
    )

    user_client = client
    login_response = user_client.post(
        "/auth/login",
        json={"email": "user1@teamremited.com", "password": "User123!!imuserone"},
    )
    assert login_response.status_code == 204

    create_response = user_client.post(
        "/drink-orders",
        json={"drink_name": "Americano", "product_url": "https://example.com/coffee"},
    )
    assert create_response.status_code == 201
    order_id = create_response.json()["order_id"]

    user_approve = user_client.patch(f"/drink-orders/{order_id}/approve")
    assert user_approve.status_code == 403

    from fastapi.testclient import TestClient
    from app.main import app

    admin_client = TestClient(app)
    admin_login = admin_client.post(
        "/auth/login",
        json={"email": "admin@teamremited.com", "password": "Admin123!!"},
    )
    assert admin_login.status_code == 204

    approve_response = admin_client.patch(f"/drink-orders/{order_id}/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    reject_response = admin_client.post(
        f"/drink-orders/{order_id}/reject", json={}
    )
    assert reject_response.status_code == 409
