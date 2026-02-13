import hashlib

from app.db import SessionLocal
from app.models.room import room as room_model

MIN_HUE_DISTANCE = 55


def _compute_room_color_hue(building: str, floor: int, room_name: str, capacity: int) -> int:
    location = f"{building}-{floor}-{room_name} ({capacity})"
    digest = hashlib.sha256(location.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 360


def _hue_distance(a: int, b: int) -> int:
    diff = abs(a - b) % 360
    return min(diff, 360 - diff)


def _find_available_hue(preferred: int, existing_hues: list[int]) -> int | None:
    if not existing_hues:
        return preferred
    for offset in range(0, 360):
        for candidate in {(preferred + offset) % 360, (preferred - offset) % 360}:
            if all(_hue_distance(candidate, hue) >= MIN_HUE_DISTANCE for hue in existing_hues):
                return candidate
    return None


def main() -> None:
    db = SessionLocal()
    try:
        rooms = (
            db.query(room_model)
            .order_by(room_model.building.asc(), room_model.floor.asc(), room_model.room_name.asc())
            .all()
        )
        existing_hues: list[int] = []
        for room in rooms:
            preferred = _compute_room_color_hue(
                room.building,
                room.floor,
                room.room_name,
                room.capacity,
            )
            hue = _find_available_hue(preferred, existing_hues)
            if hue is None:
                raise RuntimeError("Unable to assign an available color.")
            room.color_hue = hue
            existing_hues.append(hue)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
