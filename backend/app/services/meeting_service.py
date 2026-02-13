import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from pydantic import EmailStr

from fastapi import HTTPException

from app.models.room import room as room_model
from app.models.user import user as user_model
from app.models.meeting import meeting as meeting_model, meeting_attendee as meeting_attendee_model
from app.schemas import meeting as meeting_schema
from app.services import google_calendar_service
from app.core.enums import Teams

LOCATION_PATTERN = re.compile(r"^(.+?)-(\d+)-(.+?)(?:\s*\((\d+)\))?$")

def _parse_room_location(location: str):
    match = LOCATION_PATTERN.match(location.strip())
    if not match:
        return None
    building, floor_part, room_name, _capacity = match.groups()
    return building.strip(), int(floor_part), room_name.strip()

def _get_room_by_location(db: Session, location: str):
    parsed = _parse_room_location(location)
    if not parsed:
        return None
    building, floor, room_name = parsed
    return (
        db.query(room_model)
        .filter(room_model.building == building)
        .filter(room_model.floor == floor)
        .filter(room_model.room_name == room_name)
        .first()
    )

def create_meeting(db: Session, meeting: meeting_schema.MeetingCreate, room_location: str, user_id: int,):
    """Create a new meeting.

    Performs validation, prevents double-booking, and creates a meeting record.
    """
    # Verify the room exists
    normalized_location = room_location.strip()
    room = _get_room_by_location(db, normalized_location)

    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")

    # Verify the user exists
    user = db.query(user_model).filter(user_model.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Validate times
    if meeting.start_at >= meeting.end_at:
        raise HTTPException(status_code=409, detail="Start time must be before end time.")

    # 동일 회의실에 중복 예약이 있는지 확인
    overlapping_meeting = db.query(meeting_model).filter(
        meeting_model.room_id == room.room_id,
        meeting_model.start_at < meeting.end_at,
        meeting_model.end_at > meeting.start_at
    ).first()
    
    if overlapping_meeting:
        raise HTTPException(status_code=409, detail="A meeting is already scheduled for that time.")

    # 호스트가 다른 미팅에 참석 중인지 확인 (호스트/참석자)
    host_overlap = db.query(meeting_model).outerjoin(
        meeting_attendee_model,
        meeting_attendee_model.reservation_id == meeting_model.reservation_id,
    ).filter(
        or_(
            meeting_model.user_id == user_id,
            meeting_attendee_model.user_id == user_id,
        ),
        meeting_model.start_at < meeting.end_at,
        meeting_model.end_at > meeting.start_at,
    ).first()

    if host_overlap:
        raise HTTPException(status_code=409, detail="Host is already attending another meeting.")
    
    # 새 미팅 생성, 호스트는 기본 참석자로 추가
    db_meeting = meeting_model(
        room_id=room.room_id,
        user_id=user_id,
        title=meeting.title,
        notes=meeting.notes,
        start_at=meeting.start_at,
        end_at=meeting.end_at
    )
    db.add(db_meeting)
    db_meeting.attendees.append(user)

    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A meeting is already scheduled for that time.")

    db.refresh(db_meeting)
    db_meeting = (
        db.query(meeting_model)
        .options(selectinload(meeting_model.room), selectinload(meeting_model.attendees))
        .filter(meeting_model.reservation_id == db_meeting.reservation_id)
        .first()
    )

    if user.google_access_token:
        google_calendar_service.create_event_for_meeting(db, user, db_meeting, room)

    return meeting_schema.MeetingRead.model_validate(db_meeting)

def get_meeting_detail(db: Session, reservation_id: int):
    """Get detailed meeting information by reservation ID."""
    # Verify meeting exists
    db_meeting = (
        db.query(meeting_model)
        .options(
            selectinload(meeting_model.attendees),
            selectinload(meeting_model.room),
        )
        .filter(meeting_model.reservation_id == reservation_id)
        .first()
    )

    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    return meeting_schema.MeetingDetail.model_validate(db_meeting)

def delete_meeting(db: Session, location: str, start_at: datetime, actor: user_model,):
    """Delete a meeting identified by location and start time.

    Ensures the actor is the host and removes the meeting and related calendar event.
    """
    # Verify the room exists
    normalized_location = location.strip()
    room = _get_room_by_location(db, normalized_location)

    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")

    # 시간과 위치로 미팅 조회
    room_match = meeting_model.room_id == room.room_id

    window_start = start_at - timedelta(minutes=1)
    window_end = start_at + timedelta(minutes=1)

    # 타임존 불일치 문제 방지
    if start_at.tzinfo is None:
        db_meeting = db.query(meeting_model).filter(
            room_match,
            or_(
                and_(
                    func.timezone("Asia/Seoul", meeting_model.start_at) >= window_start,
                    func.timezone("Asia/Seoul", meeting_model.start_at) <= window_end,
                ),
                and_(
                    func.timezone("UTC", meeting_model.start_at) >= window_start,
                    func.timezone("UTC", meeting_model.start_at) <= window_end,
                ),
            ),
        ).first()
    else:
        db_meeting = db.query(meeting_model).filter(
            room_match,
            meeting_model.start_at >= window_start,
            meeting_model.start_at <= window_end,
        ).first()
    
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    if db_meeting.user_id != actor.user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to cancel this meeting.")
    
    if actor.google_access_token:
        google_calendar_service.delete_event_for_meeting(db, actor, db_meeting)

    db.delete(db_meeting)
    
    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not cancel the meeting.")

    return None

def update_meeting(db: Session, reservation_id: int, meeting_update: meeting_schema.MeetingUpdate, actor: user_model,):
    """Update meeting details.

    Validates permissions and prevents conflicts with other meetings.
    """
    # Verify meeting exists
    db_meeting = (
        db.query(meeting_model)
        .options(selectinload(meeting_model.room), selectinload(meeting_model.attendees))
        .filter(meeting_model.reservation_id == reservation_id)
        .first()
    )
    
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    # 액터가 호스트인지 확인
    if db_meeting.user_id != actor.user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to modify this meeting.")

    # 시간이 업데이트되었을 때 중복 예약이 있는지 확인
    new_start = meeting_update.start_at if meeting_update.start_at is not None else db_meeting.start_at
    new_end = meeting_update.end_at if meeting_update.end_at is not None else db_meeting.end_at

    # 회의실 조회
    room = db_meeting.room
    if meeting_update.location is not None:
        normalized_location = meeting_update.location.strip()
        if not normalized_location:
            raise HTTPException(status_code=400, detail="Room not found.")
        room = _get_room_by_location(db, normalized_location)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found.")

    # 그 외 시간 유효성 조건 확인 
    if new_start >= new_end:
        raise HTTPException(status_code=409, detail="Start time must be before end time.")
    
    # 동일 회의실에 중복 예약이 있는지 확인 (현재 미팅 제외)
    overlapping_meeting = db.query(meeting_model).filter(
        meeting_model.room_id == room.room_id,
        meeting_model.reservation_id != reservation_id,
        meeting_model.start_at < new_end,
        meeting_model.end_at > new_start
    ).first()
    
    if overlapping_meeting:
        raise HTTPException(status_code=409, detail="A meeting is already scheduled for that time.")

    # 호스트/참석자가 다른 미팅에 참석 중인지 확인
    attendee_ids = [att.user_id for att in db_meeting.attendees]
    participant_ids = [db_meeting.user_id, *attendee_ids]
    if participant_ids:
        participant_overlap = db.query(meeting_model).outerjoin(
            meeting_attendee_model,
            meeting_attendee_model.reservation_id == meeting_model.reservation_id,
        ).filter(
            or_(
                meeting_model.user_id.in_(participant_ids),
                meeting_attendee_model.user_id.in_(participant_ids),
            ),
            meeting_model.reservation_id != reservation_id,
            meeting_model.start_at < new_end,
            meeting_model.end_at > new_start,
        ).first()
        if participant_overlap:
            raise HTTPException(status_code=409, detail="One of the participants is already attending another meeting.")

    # Apply updates
    if meeting_update.title is not None:
        db_meeting.title = meeting_update.title
    if meeting_update.notes is not None:
        db_meeting.notes = meeting_update.notes
    if meeting_update.start_at is not None:
        db_meeting.start_at = meeting_update.start_at
    if meeting_update.end_at is not None:
        db_meeting.end_at = meeting_update.end_at
    if meeting_update.location is not None:
        db_meeting.room_id = room.room_id

    # Commit DB changes
    try:  
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not update the meeting.")

    db.refresh(db_meeting)

    if actor.google_access_token:
        google_calendar_service.update_event_for_meeting(db, actor, db_meeting, room)

    return meeting_schema.MeetingRead.model_validate(db_meeting)

def add_meeting_attendee(
    db: Session,
    reservation_id: int,
    nickname: str | None,
    name: str | None,
    email: EmailStr | None,
    actor: user_model,
):
    """Add an attendee to a meeting."""
    # Verify meeting exists
    db_meeting = (
        db.query(meeting_model)
        .options(selectinload(meeting_model.room), selectinload(meeting_model.attendees))
        .filter(meeting_model.reservation_id == reservation_id)
        .first()
    )
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    # 액터가 호스트인지 확인 
    if db_meeting.user_id != actor.user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to add attendees.")

    # 참석자 조회 후 이미 중복 참가자인지 확인
    filters = []
    if nickname:
        filters.append(user_model.nickname == nickname.strip())
    if name:
        filters.append(user_model.name == name.strip())
    if email:
        filters.append(user_model.email == email.strip())
    if not filters:
        raise HTTPException(status_code=400, detail="At least one of nickname, name, or email must be provided.")
    attendee = db.query(user_model).filter(or_(*filters)).first()
    if not attendee:
        raise HTTPException(status_code=404, detail="User not found.")

    if any(u.user_id == attendee.user_id for u in db_meeting.attendees):
        raise HTTPException(status_code=409, detail="User is already registered as an attendee.")

    # 참석자가 다른 미팅에 참석 중인지 확인 (호스트/참석자)
    attendee_overlap = db.query(meeting_model).outerjoin(
        meeting_attendee_model,
        meeting_attendee_model.reservation_id == meeting_model.reservation_id,
    ).filter(
        or_(
            meeting_model.user_id == attendee.user_id,
            meeting_attendee_model.user_id == attendee.user_id,
        ),
        meeting_model.reservation_id != reservation_id,
        meeting_model.start_at < db_meeting.end_at,
        meeting_model.end_at > db_meeting.start_at,
    ).first()
    if attendee_overlap:
        raise HTTPException(status_code=409, detail="Attendee is already attending another meeting.")

    is_busy, is_ooo = google_calendar_service.is_user_busy_or_out_of_office(
        db,
        attendee,
        db_meeting.start_at,
        db_meeting.end_at,
    )
    if is_busy or is_ooo:
        raise HTTPException(status_code=409, detail="The attendee is out of office or has another event.")

    db_meeting.attendees.append(attendee)

    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not add attendee.")

    if actor.google_access_token:
        google_calendar_service.update_event_for_meeting(
            db,
            actor,
            db_meeting,
            db_meeting.room,
        )

    return None

def add_attendee_by_team(db: Session, reservation_id: int, team: Teams, actor: user_model,):
    """Add attendees to a meeting by team membership."""
    # 미팅이 존재하는지 확인
    db_meeting = (
        db.query(meeting_model)
        .options(selectinload(meeting_model.room), selectinload(meeting_model.attendees))
        .filter(meeting_model.reservation_id == reservation_id)
        .first()
    )
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    # 액터가 호스트인지 확인 
    if db_meeting.user_id != actor.user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to add attendees.")
    
    # 팀 조회
    attendee_team = db.query(user_model).filter(
        user_model.team == team
    ).all()

    if not attendee_team:
        raise HTTPException(status_code=404, detail="Team not found.")

    # 참석자 중 다른 미팅에 참석 중인 사용자는 제외
    existing_attendee_ids = {u.user_id for u in db_meeting.attendees}
    eligible_attendees = []
    overlapping_attendees = []

    for attendee in attendee_team:
        if attendee.user_id in existing_attendee_ids:
            continue
        attendee_overlap = db.query(meeting_model).outerjoin(
            meeting_attendee_model,
            meeting_attendee_model.reservation_id == meeting_model.reservation_id,
        ).filter(
            or_(
                meeting_model.user_id == attendee.user_id,
                meeting_attendee_model.user_id == attendee.user_id,
            ),
            meeting_model.reservation_id != reservation_id,
            meeting_model.start_at < db_meeting.end_at,
            meeting_model.end_at > db_meeting.start_at,
        ).first()
        if attendee_overlap:
            overlapping_attendees.append(attendee.nickname)
        else: 
            eligible_attendees.append(attendee)

    available_attendees = []
    for attendee in eligible_attendees:
        is_busy, is_ooo = google_calendar_service.is_user_busy_or_out_of_office(
            db,
            attendee,
            db_meeting.start_at,
            db_meeting.end_at,
        )
        if is_busy or is_ooo:
            label = attendee.nickname or attendee.name or attendee.email
            overlapping_attendees.append(f"{label} (out-of-office/busy)")
            continue
        available_attendees.append(attendee)

    db_meeting.attendees.extend(available_attendees)

    # Commit DB changes
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not add attendees.")

    if actor.google_access_token and available_attendees:
        google_calendar_service.update_event_for_meeting(
            db,
            actor,
            db_meeting,
            db_meeting.room,
        )

    return overlapping_attendees

def remove_meeting_attendee(
    db: Session,
    reservation_id: int,
    nickname: str | None,
    name: str | None,
    email: EmailStr | None,
    actor: user_model,
):
    """Remove an attendee from a meeting."""
    # Verify meeting exists
    db_meeting = (
        db.query(meeting_model)
        .options(selectinload(meeting_model.room), selectinload(meeting_model.attendees))
        .filter(meeting_model.reservation_id == reservation_id)
        .first()
    )

    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    # 액터가 호스트인지 확인 
    if db_meeting.user_id != actor.user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to remove attendees.")

    # 참석자 조회 후 참석자 삭제
    filters = []
    if nickname:
        filters.append(user_model.nickname == nickname.strip().lower())
    if name:
        filters.append(user_model.name == name.strip().lower())
    if email:
        filters.append(user_model.email == email.strip().lower())
    if not filters:
        raise HTTPException(status_code=400, detail="At least one of nickname, name, or email must be provided.")
    attendee = db.query(user_model).filter(or_(*filters)).first()
    if not attendee:
        raise HTTPException(status_code=404, detail="User not found.")

    if not any(u.user_id == attendee.user_id for u in db_meeting.attendees):
        raise HTTPException(status_code=404, detail="Attendee not found for this meeting.")

    db_meeting.attendees.remove(attendee)

    # db 업데이트
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not remove attendee.")

    if actor.google_access_token:
        google_calendar_service.update_event_for_meeting(
            db,
            actor,
            db_meeting,
            db_meeting.room,
        )

    return None

def list_meetings(db: Session):
    """List all meetings."""
    meetings = (
        db.query(meeting_model)
        .options(selectinload(meeting_model.room))
        .order_by(meeting_model.start_at.asc())
        .all()
    )
    return [meeting_schema.MeetingRead.model_validate(m) for m in meetings]


def list_upcoming_meetings_for_user(db: Session, user_id: int):
    """List upcoming meetings scheduled for a specific user."""
    meetings = (
        db.query(meeting_model)
        .options(selectinload(meeting_model.room))
        .outerjoin(
            meeting_attendee_model,
            meeting_attendee_model.reservation_id == meeting_model.reservation_id,
        )
        .filter(
            or_(
                meeting_model.user_id == user_id,
                meeting_attendee_model.user_id == user_id,
            ),
            meeting_model.start_at >= func.now(),
        )
        .distinct()
        .order_by(meeting_model.start_at.asc())
        .all()
    )
    return [meeting_schema.MeetingRead.model_validate(m) for m in meetings]


