from __future__ import annotations

import html
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from app.db import SessionLocal
from app.models.room import room as room_model
from app.models.meeting import meeting as meeting_model

# Allowed character filters based on schema rules.
_ROOM_INVALID_CHARS = re.compile(r"[^가-힣a-zA-Z0-9 ]+")
_MEETING_INVALID_CHARS = re.compile(
    r"[^가-힣ㄱ-ㅎA-Za-z0-9!@#$%^&*()_+\-=\[\]{};:'\",.<>/?\\| ]+"
)
_HTML_TAGS = re.compile(r"<[^>]*>")

_ROOM_NAME_MAX = 50
_MEETING_TITLE_MAX = 50
_MEETING_NOTES_MAX = 1000

DEFAULT_BUILDING_NAME = "Main Building"


def _collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _sanitize_room_text(value: str) -> str:
    value = _ROOM_INVALID_CHARS.sub("", value)
    return _collapse_spaces(value)


def _strip_html(value: str) -> str:
    value = value.replace("\xa0", " ")
    value = html.unescape(value)
    value = _HTML_TAGS.sub("", value)
    return value


def _sanitize_meeting_text(value: str) -> str:
    value = _strip_html(value)
    value = _MEETING_INVALID_CHARS.sub("", value)
    return _collapse_spaces(value)


def _truncate(value: str, max_len: int) -> str:
    return value if len(value) <= max_len else value[:max_len].rstrip()


def main() -> None:
    db = SessionLocal()
    try:
        room_updates = 0
        meeting_updates = 0

        rooms = db.query(room_model).all()
        for room in rooms:
            original_building = room.building or ""
            original_room_name = room.room_name or ""

            cleaned_building = _sanitize_room_text(original_building)
            cleaned_room_name = _sanitize_room_text(original_room_name)

            if not cleaned_building:
                cleaned_building = DEFAULT_BUILDING_NAME
            if not cleaned_room_name:
                cleaned_room_name = f"Conference Room {room.room_id}"

            cleaned_building = _truncate(cleaned_building, _ROOM_NAME_MAX)
            cleaned_room_name = _truncate(cleaned_room_name, _ROOM_NAME_MAX)

            if cleaned_building != original_building or cleaned_room_name != original_room_name:
                room.building = cleaned_building
                room.room_name = cleaned_room_name
                room_updates += 1

        meetings = db.query(meeting_model).all()
        for meeting in meetings:
            original_title = meeting.title or ""
            original_notes = meeting.notes or ""

            cleaned_title = _sanitize_meeting_text(original_title)
            cleaned_notes = _sanitize_meeting_text(original_notes)

            if not cleaned_title:
                cleaned_title = "Meeting"

            cleaned_title = _truncate(cleaned_title, _MEETING_TITLE_MAX)
            cleaned_notes = _truncate(cleaned_notes, _MEETING_NOTES_MAX)

            if cleaned_title != original_title or cleaned_notes != original_notes:
                meeting.title = cleaned_title
                meeting.notes = cleaned_notes
                meeting_updates += 1

        if room_updates or meeting_updates:
            db.commit()

        print(
            "✅ Cleanup complete.",
            f"rooms_updated={room_updates}",
            f"meetings_updated={meeting_updates}",
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
