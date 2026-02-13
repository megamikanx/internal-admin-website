import re

from pydantic import BaseModel, field_validator, model_validator, Field, ConfigDict, EmailStr
from typing import Optional
from app.schemas import user as user_schema
from app.core.enums import Teams
from datetime import datetime, timedelta

# Constants
TEXT_REGEX = re.compile(r"^[\s\S]+$")

MIN_LEN = 1
MAX_LEN = 50

MIN_NOTES_LEN = 0
MAX_NOTES_LEN = 1000

MAX_DURATION_HOURS = 200

def now_for(dt: datetime) -> datetime:
    """Return the current local time if the given datetime has no timezone.

    Args:
        dt (datetime): The datetime to check for timezone information.

    Returns:
        datetime: Current local time if `dt` has no tzinfo, otherwise current time with `dt`'s tz.
    """
    if dt.tzinfo is None:
        return datetime.now()
    return datetime.now(tz=dt.tzinfo)

class MeetingBase(BaseModel):
    """Base schema for meetings.

    Contains core meeting fields and common validation logic.
    """
    title: str = Field(min_length=MIN_LEN, max_length=MAX_LEN)
    notes: Optional[str] = Field(default="", max_length=1000)
    location: str
    start_at: datetime
    end_at: datetime

    # Validate title format
    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not TEXT_REGEX.fullmatch(v):
            raise ValueError(
                "Title can only contain English letters, numbers, and special characters."
            )
        return v

    # Validate notes format
    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v: str) -> str:
        if v is None:
            return v
        v = v.strip()
        if v and not TEXT_REGEX.fullmatch(v):
            raise ValueError(
                "Notes can only contain English letters, numbers, and special characters."
            )
        return v
    
    # Validate if start_at is before end_at
    @model_validator(mode="after")
    def validate_start_at_end_at(self):
        if self.start_at and self.end_at and self.start_at >= self.end_at:
            raise ValueError("Start time must be before end time.")
        return self
    
    # Validate if meeting duration is within allowed limit
    @model_validator(mode="after")
    def validate_duration(self):
        if self.start_at and self.end_at and self.end_at - self.start_at > timedelta(hours=MAX_DURATION_HOURS):
            raise ValueError("Meeting duration must be less than 10 hours.")
        return self

# Meeting creation schemas
class MeetingCreate(MeetingBase):
    """Schema for creating a meeting, including additional validators."""
    # start_at value must be in the future
    @model_validator(mode="after")
    def validate_start_at_in_past(self):
        if self.start_at and self.start_at < now_for(self.start_at):
            raise ValueError("Start time must be in the future.")
        return self

    # end_at value must be in the future
    @model_validator(mode="after")
    def validate_end_at_in_past(self):
        if self.end_at and self.end_at < now_for(self.end_at):
            raise ValueError("End time must be in the future.")
        return self

# Meeting read schemas
class MeetingRead(MeetingBase):
    """Base read schema for meetings returned by the API."""
    reservation_id: int
    user_id: int

    # Allows direct SQLAlchemy model validation
    model_config = ConfigDict(from_attributes=True)

class MeetingDetail(MeetingRead):
    """Detailed meeting read schema including attendee list."""
    attendees: list[user_schema.UserRead] = []

    # Allows direct SQLAlchemy model validation
    model_config = ConfigDict(from_attributes=True)

# Meeting update schemas 
class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    location: Optional[str] = None

    # Validate that at least one field is provided for update
    @model_validator(mode="after")
    def validate_update(self):
        if (
            not self.title
            and not self.notes
            and not self.start_at
            and not self.end_at
            and not self.location
        ):
            raise ValueError("At least one of title, notes, start_at, end_at, or location must be provided for update.")
        return self

    # Validate title format
    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not TEXT_REGEX.fullmatch(v):
            raise ValueError(
                "Title can only contain English letters, numbers, and special characters."
            )
        return v

    # Validate notes format
    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if v and not TEXT_REGEX.fullmatch(v):
            raise ValueError(
                "Notes can only contain English letters, numbers, and special characters."
            )
        return v

    # Validate if start_at is before end_at
    @model_validator(mode="after")
    def validate_start_at_end_at(self):
        if self.start_at and self.end_at and self.start_at >= self.end_at:
            raise ValueError("Start time must be before end time.")
        return self
    
    # start_at value is in the future
    @model_validator(mode="after")
    def validate_start_at_in_past(self):
        if self.start_at and self.start_at < now_for(self.start_at):
            raise ValueError("Start time must be in the future.")
        return self

    # end_at value is in the future
    @model_validator(mode="after")
    def validate_end_at_in_past(self):
        if self.end_at and self.end_at < now_for(self.end_at):
            raise ValueError("End time must be in the future.")
        return self

    # Validate if meeting duration is within allowed limit
    @model_validator(mode="after")
    def validate_duration(self):
        if self.start_at and self.end_at and self.end_at - self.start_at > timedelta(hours=MAX_DURATION_HOURS):
            raise ValueError("Meeting duration must be less than 200 hours.")
        return self

class MeetingCancel(BaseModel):
    """Schema used to identify and cancel a meeting (location + start time)."""
    location: str
    start_at: datetime

class MeetingAttendeeUpdate(BaseModel):
    """Schema for adding or removing a meeting attendee."""
    nickname: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None

    # Validate that at least one field is provided
    @model_validator(mode="after")
    def validate_attendee_update(self):
        if not self.nickname and not self.name and not self.email:
            raise ValueError("At least one of nickname, name, or email must be provided.")
        return self

class MeetingUpdateByTeam(BaseModel):
    """Schema to add/update meeting attendees by team."""
    team: Teams

class MeetingAttendeeUpdateByTeamResponse(BaseModel):
    """Response schema for adding attendees by team, listing overlaps."""
    overlapping_attendees: list[str] = Field(default=[])

