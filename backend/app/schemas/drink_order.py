import re

from app.core.enums import DrinkOrderStatus
from pydantic import BaseModel, Field, field_validator, model_validator, HttpUrl, ConfigDict
from typing import Optional
from datetime import datetime

# Constants
TEXT_REGEX = re.compile(r"^[\w가-힣 !?/]+$")
MIN_LEN = 1
MAX_LEN = 50

REASON_REGEX = re.compile(
    r"^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:'\",.<>/?\\| ]+$"
)
MAX_REASON_LEN = 32

class DrinkOrderBase(BaseModel):
    """
    Base schema for drink orders.

    Includes common fields and validation for drink order payloads.
    """
    drink_name: str = Field(min_length=MIN_LEN, max_length=MAX_LEN)
    product_url: HttpUrl

    # Validate drink name format
    @field_validator("drink_name")
    @classmethod
    def validate_drink_name(cls, v: str) -> str:
        v = v.strip()
        if not TEXT_REGEX.fullmatch(v):
            raise ValueError("You can only use English letters, numbers, and certain special characters for the drink name.")
        return v

# Drink order creation schemas
class DrinkOrderCreate(DrinkOrderBase):
    """Schema for creating a new drink order."""
    pass

# Drink order read schemas
class DrinkOrderRead(DrinkOrderBase):
    """Base read schema for drink orders returned from the API."""
    order_id: int
    status: DrinkOrderStatus
    submitted_at: Optional[datetime] = None

    # Allows direct SQLAlchemy model validation
    model_config = ConfigDict(from_attributes=True)

class DrinkOrderUserRead(DrinkOrderRead):
    """Read schema for users viewing their own drink orders."""
    reviewed_by: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    reason: Optional[str] = None

class DrinkOrderAdminRead(DrinkOrderRead):
    """Read schema for admins viewing all drink orders."""
    user_id: int
    reviewed_by: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    reason: Optional[str] = None

# Drink order update schemas
class DrinkOrderAdminUpdate(BaseModel):
    """Schema for admin updates to a drink order (e.g. rejection reason)."""
    reason: Optional[str] = Field(default="")

    # Validate reason format
    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not REASON_REGEX.fullmatch(v):
            raise ValueError("You can only use English letters, numbers, and certain special characters for notes")
        return v
    
    # Validate reason length
    @model_validator(mode="after")
    def validate_reason_length(self):
        if self.reason and len(self.reason) > MAX_REASON_LEN:
            raise ValueError("Notes cannot exceed 32 characters.")
        return self