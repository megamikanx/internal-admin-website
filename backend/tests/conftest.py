import os
import sys

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.core.security import get_password_hash
from app.core.enums import Teams
from app.db import SessionLocal
from app.main import app
from app.models.drink_order import drink_order as DrinkOrder
from app.models.meeting import meeting as Meeting, meeting_attendee as MeetingAttendee
from app.models.room import room as Room
from app.models.user import user as User


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def clean_db(db):
    db.query(MeetingAttendee).delete()
    db.query(DrinkOrder).delete()
    db.query(Meeting).delete()
    db.query(Room).delete()
    db.query(User).delete()
    db.commit()


def create_user(
    db,
    *,
    email: str,
    password: str,
    nickname: str,
    name: str,
    admin_status: bool = False,
    team: Teams = Teams.dev,
):
    user = User(
        email=email,
        name=name,
        nickname=nickname,
        admin_status=admin_status,
        team=team,
        password_hash=get_password_hash(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_room(db, *, location: str):
    room = Room(location=location)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def login(client, *, email: str, password: str):
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    return response
