from datetime import datetime, timedelta

from tests.conftest import create_room, create_user


def test_meeting_conflicts(client, db):
    create_room(db, location="8F 회의실")
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

    base_start = datetime.now() + timedelta(hours=2)
    meeting_a = {
        "location": "8F 회의실",
        "title": "미팅 A",
        "start_at": base_start.isoformat(timespec="seconds"),
        "end_at": (base_start + timedelta(hours=1)).isoformat(timespec="seconds"),
    }
    response_a = client.post("/meetings", json=meeting_a)
    assert response_a.status_code == 201

    meeting_overlap = {
        "location": "8F 회의실",
        "title": "미팅 B",
        "start_at": (base_start + timedelta(minutes=30)).isoformat(timespec="seconds"),
        "end_at": (base_start + timedelta(hours=1, minutes=30)).isoformat(timespec="seconds"),
    }
    response_overlap = client.post("/meetings", json=meeting_overlap)
    assert response_overlap.status_code == 409

    meeting_touching = {
        "location": "8F 회의실",
        "title": "미팅 C",
        "start_at": (base_start + timedelta(hours=1)).isoformat(timespec="seconds"),
        "end_at": (base_start + timedelta(hours=2)).isoformat(timespec="seconds"),
    }
    response_touching = client.post("/meetings", json=meeting_touching)
    assert response_touching.status_code == 201
