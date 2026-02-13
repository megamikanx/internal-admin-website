import hashlib

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fastapi import HTTPException

from app.models.room import room as room_model
from app.schemas import room as room_schema

MIN_HUE_DISTANCE = 55

def _compute_room_color_hue(building: str, floor: int, room_name: str, capacity: int) -> int:
    """Hash a location string and convert the digest to a color hue."""
    location = f"{building}-{floor}-{room_name} ({capacity})"
    digest = hashlib.sha256(location.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 360

def _hue_distance(a: int, b: int) -> int:
    """Helper to compute the minimal distance between two hue values."""
    diff = abs(a - b) % 360
    return min(diff, 360 - diff)

def _find_available_hue(preferred: int, existing_hues: list[int]) -> int | None:
    """Find a hue that does not conflict with existing hues."""
    if not existing_hues:
        return preferred
    for offset in range(0, 360):
        for candidate in {(preferred + offset) % 360, (preferred - offset) % 360}:
            if all(_hue_distance(candidate, hue) >= MIN_HUE_DISTANCE for hue in existing_hues):
                return candidate
    return None

def create_room(db: Session, room: room_schema.RoomCreate):
    """Create a meeting room and assign it a non-conflicting color hue."""
    normalized_building = room.building.strip()
    normalized_room_name = room.room_name.strip()
    existing_room = (
        db.query(room_model)
        .filter(room_model.building == normalized_building)
        .filter(room_model.floor == room.floor)
        .filter(room_model.room_name == normalized_room_name)
        .first()
    )
    if existing_room:
        raise HTTPException(status_code=409, detail="A room is already registered at this location.")
    
    preferred_hue = _compute_room_color_hue(
        normalized_building,
        room.floor,
        normalized_room_name,
        room.capacity,
    )
    existing_hues = [
        hue
        for (hue,) in db.query(room_model.color_hue).all()
        if hue is not None
    ]
    hue = _find_available_hue(preferred_hue, existing_hues)
    if hue is None:
        raise HTTPException(status_code=409, detail="Unable to assign an available color.")

    db_room = room_model(
        building=normalized_building,
        floor=room.floor,
        room_name=normalized_room_name,
        color_hue=hue,
    )

    db.add(db_room)
    
    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not register the room.")

    db.refresh(db_room)
    
    return room_schema.RoomRead.model_validate(db_room)

def delete_room(db: Session, payload: room_schema.RoomDelete):
    """Delete a meeting room identified by payload."""
    normalized_building = payload.building.strip()
    normalized_room_name = payload.room_name.strip()
    room = (
        db.query(room_model)
        .filter(room_model.building == normalized_building)
        .filter(room_model.floor == payload.floor)
        .filter(room_model.room_name == normalized_room_name)
        .first()
    )

    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")

    db.delete(room)
    
    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not delete the room.")

    return None

def list_rooms(db: Session):
    """ 모든 회의실 조회 """
    rooms = db.query(room_model).order_by(room_model.room_id.asc()).all()

    return [room_schema.RoomRead.model_validate(r) for r in rooms]
