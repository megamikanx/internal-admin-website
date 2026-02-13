import re

from pydantic import BaseModel, field_validator, Field, ConfigDict

# Constants
LOCATION_REGEX = re.compile(r"^[\s\S]+$")

MIN_LEN = 1
MAX_LEN = 50

DEFAULT_CAPACITY = 8

DEFAULT_BUILDING_NAME = "Building name"

class RoomBase(BaseModel):
    """Base schema for meeting rooms.

    Includes location and capacity validation.
    """
    building: str = Field(default=DEFAULT_BUILDING_NAME)
    floor: int
    room_name: str
    capacity: int = Field(default=DEFAULT_CAPACITY)

    # Validate building name format
    @field_validator("building")
    @classmethod
    def validate_location(cls, v: str) -> str:
        v = v.strip()
        if not LOCATION_REGEX.fullmatch(v):
            raise ValueError("Building name can only contain English letters, numbers, and special characters.")
        return v
    
    # Validate floor number
    @field_validator("floor")
    @classmethod
    def validate_floor(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Floor number must be 1 or greater.")
        return v
    
    # Validate room name format
    @field_validator("room_name")
    @classmethod
    def validate_room_name(cls, v: str) -> str:
        v = v.strip()
        if not LOCATION_REGEX.fullmatch(v):
            raise ValueError("Room name can only contain English letters, numbers, and special characters.")
        return v

    # Validate capacity
    @field_validator("capacity")
    @classmethod
    def validate_capacity(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Capacity must be 1 or greater.")
        return v

# Meeting creation schemas
class RoomCreate(RoomBase): 
    """Schema for creating a new meeting room."""
    pass

# Meeting read schemas
class RoomRead(RoomBase):
    """Base read schema for meeting rooms returned by the API."""
    room_id: int
    color_hue: int | None = None

    # Allows direct SQLAlchemy model validation
    model_config = ConfigDict(from_attributes=True)

class RoomDelete(RoomBase):
    """Schema for deleting a meeting room."""
    pass