import logging
import time

from fastapi import APIRouter, Depends, status, Response

from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db import get_db
from app.schemas import meeting as meeting_schema
from app.services import meeting_service

# Only accessible to logged-in users
router = APIRouter(
    prefix="/meetings",
    tags=["meetings"],
    dependencies=[Depends(get_current_user)],
)

def _log_timing(name: str, start: float, extra: str = "") -> None:
    logger = logging.getLogger("uvicorn.error")
    suffix = f" {extra}" if extra else ""
    logger.info(f"[MEETINGS] {name} total_time={time.perf_counter() - start:.6f}s{suffix}")

@router.get("", response_model=list[meeting_schema.MeetingRead])
def list_meetings(
    db: Session = Depends(get_db),
):
    """
    List all meetings.
    """
    start_total = time.perf_counter()
    results = meeting_service.list_meetings(db)
    _log_timing("list_meetings", start_total)
    return results

@router.post("", response_model=meeting_schema.MeetingRead, status_code=status.HTTP_201_CREATED)
def create_meeting(
    payload: meeting_schema.MeetingCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new meeting.
    """
    start_total = time.perf_counter()
    result = meeting_service.create_meeting(
        db,
        payload,
        payload.location,
        current_user.user_id,
    )
    _log_timing("create_meeting", start_total, f"user_id={current_user.user_id}")
    return result

@router.get("/me/upcoming", response_model=list[meeting_schema.MeetingRead])
def get_my_upcoming_meetings(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List upcoming meetings for the current user.
    """
    start_total = time.perf_counter()
    results = meeting_service.list_upcoming_meetings_for_user(db, current_user.user_id)
    _log_timing("list_my_upcoming", start_total, f"user_id={current_user.user_id}")
    return results

@router.get("/{reservation_id}/detail", response_model=meeting_schema.MeetingDetail)
def get_meeting_detail(
    reservation_id: int,
    db: Session = Depends(get_db),
):
    """
    Get detailed information for a meeting.
    """
    start_total = time.perf_counter()
    result = meeting_service.get_meeting_detail(db, reservation_id)
    _log_timing("meeting_detail", start_total, f"reservation_id={reservation_id}")
    return result

@router.patch("/{reservation_id}", response_model=meeting_schema.MeetingRead)
def update_meeting(
    reservation_id: int,
    meeting_update: meeting_schema.MeetingUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update meeting information.
    """
    start_total = time.perf_counter()
    result = meeting_service.update_meeting(db, reservation_id, meeting_update, actor=current_user)
    _log_timing(
        "update_meeting",
        start_total,
        f"reservation_id={reservation_id} user_id={current_user.user_id}",
    )
    return result

@router.post("/cancel", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
    payload: meeting_schema.MeetingCancel,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel a meeting matching the provided payload.
    """
    start_total = time.perf_counter()
    meeting_service.delete_meeting(
        db,
        location=payload.location,
        start_at=payload.start_at,
        actor=current_user,
    )
    _log_timing("cancel_meeting", start_total, f"user_id={current_user.user_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{reservation_id}/attendees", status_code=status.HTTP_204_NO_CONTENT)
def add_attendee(
    reservation_id: int,
    payload: meeting_schema.MeetingAttendeeUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add an attendee to a meeting.
    """
    start_total = time.perf_counter()
    meeting_service.add_meeting_attendee(
        db,
        reservation_id=reservation_id,
        nickname=payload.nickname,
        name=payload.name,
        email=payload.email,
        actor=current_user,
    )
    _log_timing(
        "add_attendee",
        start_total,
        f"reservation_id={reservation_id} user_id={current_user.user_id}",
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{reservation_id}/attendees/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove_attendee(
    reservation_id: int,
    payload: meeting_schema.MeetingAttendeeUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove an attendee from a meeting.
    """
    start_total = time.perf_counter()
    meeting_service.remove_meeting_attendee(
        db,
        reservation_id=reservation_id,
        nickname=payload.nickname,
        name=payload.name,
        email=payload.email,
        actor=current_user,
    )
    _log_timing(
        "remove_attendee",
        start_total,
        f"reservation_id={reservation_id} user_id={current_user.user_id}",
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post(
    "/{reservation_id}/attendees/team",
    response_model=meeting_schema.MeetingAttendeeUpdateByTeamResponse,
    status_code=status.HTTP_200_OK,
)
def add_attendee_by_team(
    reservation_id: int,
    payload: meeting_schema.MeetingUpdateByTeam,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add attendees to a meeting by team membership.
    """
    start_total = time.perf_counter()
    overlapping_attendees = meeting_service.add_attendee_by_team(
        db,
        reservation_id=reservation_id,
        team=payload.team,
        actor=current_user,
    )
    _log_timing(
        "add_attendee_by_team",
        start_total,
        f"reservation_id={reservation_id} user_id={current_user.user_id} team={payload.team}",
    )
    return {"overlapping_attendees": overlapping_attendees}
