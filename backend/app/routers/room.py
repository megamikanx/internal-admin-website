from fastapi import APIRouter, Depends, status, Response

from sqlalchemy.orm import Session

from app.core.security import require_admin, get_current_user
from app.db import get_db
from app.schemas import room as room_schema
from app.services import room_service

# Only accessible to logged-in users
router = APIRouter(
    prefix="/rooms",
    tags=["rooms"],
    dependencies=[Depends(get_current_user)],
)

@router.get("", response_model=list[room_schema.RoomRead])
def list_rooms(db: Session = Depends(get_db)):
    """
    List all meeting rooms.
    """
    return room_service.list_rooms(db)

@router.post("", response_model=room_schema.RoomRead, status_code=status.HTTP_201_CREATED)
def create_room(
    room: room_schema.RoomCreate,
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """
    Create a new meeting room (admin only).
    """
    return room_service.create_room(db, room)

@router.post("/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    payload: room_schema.RoomDelete,
    db: Session = Depends(get_db),
    _ = Depends(require_admin),
):
    """
    Delete a meeting room (admin only).
    """
    room_service.delete_room(db, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
