from datetime import datetime, timedelta

from tests.conftest import create_room, create_user, login
from app.models.meeting import meeting as Meeting


def test_overlapping_meeting_does_not_create_extra_row(client, db):
    create_room(db, location="8F 회의실")
    create_user(
        db,
        email="user1@teamremited.com",
        password="User123!!imuserone",
        nickname="user1",
        name="사용자",
    )
    assert login(client, email="user1@teamremited.com", password="User123!!imuserone").status_code == 204

    base_start = datetime.now() + timedelta(hours=2)
    meeting_a = {
        "location": "8F 회의실",
        "title": "미팅 A",
        "start_at": base_start.isoformat(timespec="seconds"),
        "end_at": (base_start + timedelta(hours=1)).isoformat(timespec="seconds"),
    }
    response_a = client.post("/meetings", json=meeting_a)
    assert response_a.status_code == 201

    before_count = db.query(Meeting).count()

    meeting_b = {
        "location": "8F 회의실",
        "title": "미팅 B",
        "start_at": (base_start + timedelta(minutes=30)).isoformat(timespec="seconds"),
        "end_at": (base_start + timedelta(hours=1, minutes=30)).isoformat(timespec="seconds"),
    }
    response_b = client.post("/meetings", json=meeting_b)
    assert response_b.status_code == 409

    after_count = db.query(Meeting).count()
    assert after_count == before_count
