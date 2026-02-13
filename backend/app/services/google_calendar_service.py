from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.core.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
from app.models.meeting import meeting as meeting_model, meeting_attendee as meeting_attendee_model
from app.models.room import room as room_model, DEFAULT_CAPACITY
from app.models.user import user as user_model
from app.core.enums import ResponseStatus

# Constants
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar"]
TOKEN_URI = "https://oauth2.googleapis.com/token"

LOCATION_PATTERN = re.compile(r"^(.+?)-(\d+)-(.+?)(?:\s*\((\d+)\))?$")

_LAST_SYNC_AT: datetime | None = None

def set_last_sync(at: datetime | None = None) -> datetime:
    """
    Record the last synchronization time.
    """
    global _LAST_SYNC_AT
    _LAST_SYNC_AT = at or datetime.now(timezone.utc)
    return _LAST_SYNC_AT

def get_last_sync() -> datetime | None:
    """
    Return the last recorded synchronization time, or None if never synced.
    """
    return _LAST_SYNC_AT

# Google calendar setting functions
def _get_calendar_id(user: user_model) -> str:
    """
    Return the Google Calendar ID for a user, defaulting to 'primary'.
    """
    return user.google_calendar_id or "primary"

def _normalize_expiry(expiry: datetime | str | None) -> datetime | None:
    """
    Normalize Google token expiry to a naive UTC datetime.

    Accepts either a datetime or ISO-format string and returns a naive datetime in UTC.
    """
    if not expiry:
        return None

    if isinstance(expiry, str):
        try:
            expiry = datetime.fromisoformat(expiry)
        except ValueError:
            return None

    if expiry.tzinfo is None:
        return expiry

    return expiry.astimezone(timezone.utc).replace(tzinfo=None)

def _ensure_credentials_expiry_naive(creds: Credentials) -> None:
    """
    Ensure credentials.expiry is a naive datetime (no tzinfo).
    """
    creds.expiry = _normalize_expiry(creds.expiry)
    try:
        creds._expiry = creds.expiry
    except Exception:
        pass

def _build_credentials(user: user_model) -> Credentials | None:
    """
    Build a Credentials object from a user's stored tokens.
    """
    if not user.google_access_token:
        return None

    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri=TOKEN_URI,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=GOOGLE_SCOPES,
        expiry=_normalize_expiry(user.google_token_expiry),
    )
    _ensure_credentials_expiry_naive(creds)

    return creds

def _refresh_credentials(db: Session, user: user_model, creds: Credentials) -> None:
    """
    Refresh and persist Google OAuth credentials if necessary.
    """
    _ensure_credentials_expiry_naive(creds)

    if not creds.refresh_token:
        return

    # Check if token is still valid (with 60s buffer)
    if creds.expiry is not None:
        skewed_expiry = creds.expiry - timedelta(seconds=60)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if now < skewed_expiry:
            return

    try:
        creds.refresh(Request())
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Unable to refresh Google token.") from exc

    # Save token
    user.google_access_token = creds.token
    _ensure_credentials_expiry_naive(creds)
    user.google_token_expiry = _normalize_expiry(creds.expiry)
    if creds.refresh_token:
        user.google_refresh_token = creds.refresh_token

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to save Google token.") from exc

def _get_calendar_service(db: Session, user: user_model):
    """
    Create and return a Google Calendar service for the given user.

    Returns None if the user has no stored access token.
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth environment variables are not configured.")

    # Build credentials; return None on failure
    creds = _build_credentials(user)

    if not creds:
        return None
    _refresh_credentials(db, user, creds)
    _ensure_credentials_expiry_naive(creds)

    return build("calendar", "v3", credentials=creds)

def _to_rfc3339(dt: datetime) -> str:
    """
    Convert a datetime to an RFC3339-formatted string.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def _is_calendar_busy(service, calendar_id: str, time_min: str, time_max: str) -> bool:
    """
    Return True if the calendar has busy blocks between time_min and time_max.
    """
    body = {
        "timeMin": time_min,
        "timeMax": time_max,
        "items": [{"id": calendar_id}],
    }
    result = service.freebusy().query(body=body).execute()
    calendars = result.get("calendars", {})
    busy_blocks = calendars.get(calendar_id, {}).get("busy", [])
    return bool(busy_blocks)

def _has_out_of_office(service, calendar_id: str, time_min: str, time_max: str) -> bool:
    """
    Return True if an outOfOffice event exists in the calendar window.
    """
    events = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    for event in events.get("items", []):
        if event.get("status") == "cancelled":
            continue
        if event.get("eventType") == "outOfOffice":
            return True
    return False

def is_user_busy_or_out_of_office(
    db: Session,
    user: user_model,
    start_at: datetime,
    end_at: datetime,
) -> tuple[bool, bool]:
    """
    Check if the user is busy or has an out-of-office event during the meeting window.

    Returns a tuple (is_busy, is_out_of_office).
    """
    service = _get_calendar_service(db, user)
    if not service:
        return False, False

    time_min = _to_rfc3339(start_at)
    time_max = _to_rfc3339(end_at)
    calendar_id = _get_calendar_id(user)

    try:
        is_busy = _is_calendar_busy(service, calendar_id, time_min, time_max)
        is_ooo = _has_out_of_office(service, calendar_id, time_min, time_max)
    except HttpError as exc:
        raise HTTPException(status_code=502, detail="Google 캘린더 상태 확인에 실패했습니다.") from exc

    return is_busy, is_ooo

# Google Calendar event functions
def _build_event_payload(db: Session, meeting: meeting_model, room: room_model | None):
    """
    Build the payload for creating/updating a Google Calendar event from a meeting.
    """
    tz = "Asia/Seoul"

    if meeting.start_at and meeting.start_at.tzinfo:
        tz = meeting.start_at.tzinfo.tzname(meeting.start_at) or tz

    # Only include attendees with valid response statuses
    allowed_statuses = {"needsAction", "accepted", "tentative"}
    attendees = []
    attendee_rows = (
        db.query(meeting_attendee_model, user_model)
        .join(user_model, meeting_attendee_model.user_id == user_model.user_id)
        .filter(meeting_attendee_model.reservation_id == meeting.reservation_id)
        .all()
    )
    if attendee_rows:
        for attendee_link, attendee in attendee_rows:
            status = attendee_link.response_status or "needsAction"
            if hasattr(status, "value"):
                status = status.value
            if status in allowed_statuses:
                attendees.append(
                    {
                        "email": attendee.email,
                        "displayName": attendee.name,
                        "responseStatus": status,
                    }
                )
    else:
        attendees = [
            {
                "email": attendee.email,
                "displayName": attendee.name,
                "responseStatus": getattr(attendee, "response_status", "needsAction"),
            }
            for attendee in getattr(meeting, "attendees", [])
            if getattr(attendee, "response_status", "needsAction") in allowed_statuses
        ]

    return {
        "summary": meeting.title,
        "description": meeting.notes or "",
        "location": room.location if room else None,
        "start": {"dateTime": meeting.start_at.isoformat(), "timeZone": tz},
        "end": {"dateTime": meeting.end_at.isoformat(), "timeZone": tz},
        "attendees": attendees,
    }

def _normalize_response_status(status: str | None) -> ResponseStatus:
    """
    Normalize a response status string to a ResponseStatus enum.

    Defaults to `ResponseStatus.needsAction` for unknown or missing values.
    """
    if not status:
        return ResponseStatus.needsAction
    try:
        return ResponseStatus(status)
    except ValueError:
        return ResponseStatus.needsAction

def _sync_attendees_from_event(
    db: Session,
    meeting: meeting_model,
    event_attendees: list[dict] | None,
    actor: user_model,
) -> None:
    """
    Synchronize meeting attendees from a calendar event's attendee list.
    """
    if event_attendees is None:
        return

    # Map desired statuses by email
    desired_status_by_email: dict[str, str] = {}
    for attendee in event_attendees:
        email = attendee.get("email")
        if not email:
            continue
        desired_status_by_email[email.lower()] = attendee.get("responseStatus") or "needsAction"


    # Check for overlapping attendees
    existing_links = (
        db.query(meeting_attendee_model)
        .filter(meeting_attendee_model.reservation_id == meeting.reservation_id)
        .all()
    )
    existing_by_user_id = {link.user_id: link for link in existing_links}

    def ensure_link(user_id: int) -> None:
        """
        Ensure an attendee link exists for the given user ID; create if missing.
        """
        if user_id in existing_by_user_id:
            return
        
        # Create link
        link = meeting_attendee_model(
            reservation_id=meeting.reservation_id,
            user_id=user_id,
            response_status=ResponseStatus.needsAction,
        )
        db.add(link)
        existing_by_user_id[user_id] = link

    # Fetch users by email
    if desired_status_by_email:
        users = (
            db.query(user_model)
            .filter(user_model.email.in_(desired_status_by_email.keys()))
            .all()
        )
    else:
        users = []

    # Set desired user IDs
    desired_user_ids: set[int] = set()

    for user in users:
        status_value = desired_status_by_email.get(user.email.lower())
        status_enum = _normalize_response_status(status_value)
        desired_user_ids.add(user.user_id)
        link = existing_by_user_id.get(user.user_id)
        if link:
            if link.response_status != status_enum:
                link.response_status = status_enum
        else:
            link = meeting_attendee_model(
                reservation_id=meeting.reservation_id,
                user_id=user.user_id,
                response_status=status_enum,
            )
            db.add(link)
            existing_by_user_id[user.user_id] = link

    # Remove links not in desired attendees, except for host and actor
    keep_user_ids = {meeting.user_id, actor.user_id}
    for link in existing_links:
        if link.user_id in keep_user_ids:
            continue
        if link.user_id not in desired_user_ids:
            db.delete(link)

    ensure_link(meeting.user_id)
    ensure_link(actor.user_id)

def create_event_for_meeting(
    db: Session,
    user: user_model,
    meeting: meeting_model,
    room: room_model | None,
):
    """
    Create and sync a Google Calendar event for the meeting.
    """
    service = _get_calendar_service(db, user)

    # Return if no calendar service
    if not service:
        return
    try:
        created = (
            service.events()
            .insert(calendarId=_get_calendar_id(user), body=_build_event_payload(db, meeting, room))
            .execute()
        )
    except HttpError as exc:
        raise HTTPException(status_code=502, detail="Failed to create event in Google Calendar.") from exc

    # Update sync info
    meeting.google_event_id = created.get("id")
    meeting.google_last_synced_at = datetime.now(timezone.utc)

    db.add(meeting)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unable to save Google sync information.") from exc

def update_event_for_meeting(
    db: Session,
    user: user_model,
    meeting: meeting_model,
    room: room_model | None,
):
    """
    Update the Google Calendar event corresponding to the meeting.
    """
    if not meeting.google_event_id:
        return

    service = _get_calendar_service(db, user)

    # Return if no calendar service
    if not service:
        return
    try:
        (
            service.events()
            .update(
                calendarId=_get_calendar_id(user),
                eventId=meeting.google_event_id,
                body=_build_event_payload(db, meeting, room),
            )
            .execute()
        )
    except HttpError as exc:
        raise HTTPException(status_code=502, detail="Failed to update event in Google Calendar.") from exc

    # Update sync info
    meeting.google_last_synced_at = datetime.now(timezone.utc)
    db.add(meeting)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Google 동기화 정보를 저장할 수 없습니다.") from exc

def delete_event_for_meeting(
    db: Session,
    user: user_model,
    meeting: meeting_model,
):
    """
    Delete the Google Calendar event for a meeting, if present.
    """
    if not meeting.google_event_id:
        return

    service = _get_calendar_service(db, user)

    # Return if no calendar service
    if not service:
        return
    try:
        service.events().delete(
            calendarId=_get_calendar_id(user),
            eventId=meeting.google_event_id,
        ).execute()
    except HttpError as exc:
        raise HTTPException(status_code=502, detail="Failed to delete event from Google Calendar.") from exc

def _parse_event_datetime(event_time: dict) -> datetime | None:
    """
    Parse event datetime and convert to a Python datetime.

    Returns None for all-day events or unparseable values.
    """
    date_time = event_time.get("dateTime")

    if date_time:
        if date_time.endswith("Z"):
            date_time = date_time.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(date_time)
        except ValueError:
            return None

    if event_time.get("date"):
        return None

    return None

def _parse_room_text(room_text: str):
    """
    Parse a room text string from a calendar resource into components.

    Expected format: "Building-Floor-RoomName (Capacity)".
    """
    match = LOCATION_PATTERN.match(room_text.strip())

    if not match:
        return None

    building, floor_part, room_name, capacity = match.groups()
    capacity_value = int(capacity) if capacity else None

    return building.strip(), int(floor_part), room_name.strip(), capacity_value

def _get_room_from_event(db: Session, event: dict):
    """ 
    Return a Room object from a calendar event's resource, creating it if missing.
    """
    attendees = event.get("attendees") or []
    room_text = None
    for attendee in attendees:
        if attendee.get("resource"):
            room_text = attendee.get("displayName") or attendee.get("email")
            break

    if not room_text:
        return None

    parsed = _parse_room_text(room_text)

    if not parsed:
        return None

    building, floor, room_name, capacity = parsed
    room = (
        db.query(room_model)
        .filter(room_model.building == building)
        .filter(room_model.floor == floor)
        .filter(room_model.room_name == room_name)
        .first()
    )

    if room:
        return room

    room = room_model(
        building=building,
        floor=floor,
        room_name=room_name,
        capacity=capacity if capacity is not None else DEFAULT_CAPACITY,
    )

    db.add(room)
    db.flush()
    return room

def _upsert_meeting_from_event(db: Session, user: user_model, event: dict):
    """
    Create or update a DB meeting from a calendar event.
    """
    if event.get("status") == "cancelled":
        return

    event_id = event.get("id")
    if not event_id:
        return

    # Parse start/end datetimes
    start_at = _parse_event_datetime(event.get("start", {}))
    end_at = _parse_event_datetime(event.get("end", {}))
    if not start_at or not end_at:
        return

    # Get room from event
    room = _get_room_from_event(db, event)

    # Get host user from event
    organizer = event.get("organizer") or event.get("creator") or {}
    organizer_email = organizer.get("email")
    host_user = None
    if organizer_email:
        host_user = (
            db.query(user_model)
            .filter(func.lower(user_model.email) == organizer_email.lower())
            .first()
        )

    # Upsert meeting
    meeting = (
        db.query(meeting_model)
        .filter(meeting_model.google_event_id == event_id)
        .first()
    )
    if meeting:
        meeting.title = event.get("summary") or meeting.title
        meeting.notes = event.get("description") or meeting.notes
        meeting.start_at = start_at
        meeting.end_at = end_at
        if room:
            meeting.room_id = room.room_id
        if host_user:
            meeting.user_id = host_user.user_id
        meeting.google_last_synced_at = datetime.now(timezone.utc)
        meeting.google_sync_status = "google_overwrite"
        _sync_attendees_from_event(db, meeting, event.get("attendees"), user)
        return

    if not room:
        return

    meeting = meeting_model(
        room_id=room.room_id,
        user_id=host_user.user_id if host_user else user.user_id,
        title=event.get("summary") or "Google 일정",
        notes=event.get("description") or "",
        start_at=start_at,
        end_at=end_at,
        google_event_id=event_id,
        google_last_synced_at=datetime.now(timezone.utc),
        google_sync_status="google_overwrite",
    )
    db.add(meeting)
    db.flush()
    _sync_attendees_from_event(db, meeting, event.get("attendees"), user)

def _delete_meeting_from_event(db: Session, event: dict):
    """ 
    Delete the meeting corresponding to a deleted calendar event.
    """
    event_id = event.get("id")

    if not event_id:
        return

    meeting = (
        db.query(meeting_model)
        .filter(meeting_model.google_event_id == event_id)
        .first()
    )
    if meeting:
        db.delete(meeting)

# Main sync functions
def sync_user_calendar(
    db: Session,
    user: user_model,
    *,
    time_min: datetime | None = None,
    time_max: datetime | None = None,
):
    """ 
    Sync a user's Google Calendar events into the local database. 
    """
    if not user.google_access_token or not user.google_refresh_token:
        return
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return

    # 유저 토큰 생성   
    creds = _build_credentials(user)
    if not creds:
        return
    _refresh_credentials(db, user, creds)

    _ensure_credentials_expiry_naive(creds)
    service = build("calendar", "v3", credentials=creds)

    # 기본값: 365일 전 이벤트부터 조회
    if time_min is None:
        time_min = datetime.now(timezone.utc) - timedelta(days=365)
    time_min_iso = time_min.isoformat()
    time_max_iso = time_max.isoformat() if time_max else None
    page_token: str | None = None
    full_sync = False

    # 더 이상 이벤트가 없을 때까지 루프
    while True:
        try:
            if user.google_sync_token and not full_sync:
                request = service.events().list(
                    calendarId=_get_calendar_id(user),
                    syncToken=user.google_sync_token,
                    showDeleted=True,
                    singleEvents=True,
                    pageToken=page_token,
                )
            else:
                request = service.events().list(
                    calendarId=_get_calendar_id(user),
                    timeMin=time_min_iso,
                    timeMax=time_max_iso,
                    showDeleted=True,
                    singleEvents=True,
                    orderBy="startTime",
                    pageToken=page_token,
                )
            events = request.execute()
        except HttpError as exc:
            if exc.resp.status == 410:
                user.google_sync_token = None
                db.commit()
                full_sync = True
                page_token = None
                continue
            raise

        for event in events.get("items", []):
            try:
                if event.get("status") == "cancelled":
                    _delete_meeting_from_event(db, event)
                else:
                    _upsert_meeting_from_event(db, user, event)
            except IntegrityError as exc:
                db.rollback()
                start_at = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date")
                logging.getLogger("uvicorn.error").warning(
                    "[GOOGLE SYNC] skipped event due to DB constraint "
                    "event_id=%s user_id=%s title=%s start_at=%s error=%s",
                    event.get("id"),
                    user.user_id,
                    event.get("summary"),
                    start_at,
                    exc,
                )
                continue

        page_token = events.get("nextPageToken")
        if not page_token:
            next_token = events.get("nextSyncToken")
            if next_token and not full_sync:
                user.google_sync_token = next_token
            db.commit()
            break

def sync_all_users(
    db: Session,
    *,
    time_min: datetime | None = None,
    time_max: datetime | None = None,
) -> None:
    """ 
    Google 캘린더 전체 유저 동기화 
    """
    logger = logging.getLogger("uvicorn.error")
    start_total = time.perf_counter()
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.info("[GOOGLE AUTO SYNC] skipped (missing Google OAuth config)")
        return
    users = (
        db.query(user_model)
        .filter(user_model.google_access_token.isnot(None))
        .all()
    )
    kst_now = datetime.now(ZoneInfo("Asia/Seoul")).isoformat()
    logger.info(f"[GOOGLE AUTO SYNC] start users={len(users)} at={kst_now}")
    for user in users:
        user_start = time.perf_counter()
        try:
            sync_user_calendar(db, user, time_min=time_min, time_max=time_max)
        except HTTPException:
            continue
        user_end = time.perf_counter()
        logger.info(
            "[GOOGLE AUTO SYNC] user_id=%s email=%s total_time=%.6fs",
            user.user_id,
            user.email,
            user_end - user_start,
        )
    set_last_sync()
    end_total = time.perf_counter()
    kst_done = datetime.now(ZoneInfo("Asia/Seoul")).isoformat()
    logger.info(f"[GOOGLE AUTO SYNC] done at={kst_done} total_time={end_total - start_total:.6f}s")
