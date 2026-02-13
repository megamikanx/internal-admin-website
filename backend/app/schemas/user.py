import re

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict
from typing import Optional
from app.core.enums import Teams

# Constants
NAME_REGEX = re.compile(r"^[a-zA-Z0-9 .]+$")

MIN_LEN = 1
MAX_LEN = 20

MIN_PW_LEN = 6
MAX_PW_LEN = 72

PW_PATTERN = re.compile(r'^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:\'",.<>/?\\| ]+$')
DEFAULT_EMAIL_DOMAIN = "@example.com"

class UserBase(BaseModel):
    """Base schema for users.

    Contains common profile fields and basic validation.
    """
    nickname: str = Field(min_length=MIN_LEN, max_length=MAX_LEN)
    name: str = Field(min_length=MIN_LEN, max_length=MAX_LEN)
    email: EmailStr
    team: Teams

    # Validate nickname format
    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        v = v.strip()
        if not NAME_REGEX.fullmatch(v):
            raise ValueError("Nickname can only contain English letters, numbers, and special characters.")
        return v

    # Validate email format
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip()
        if v.lower().endswith(DEFAULT_EMAIL_DOMAIN) is False:
            raise ValueError(f"Email must be from the {DEFAULT_EMAIL_DOMAIN} domain.")

        # Only allow lowercase emails
        if v.lower() != v:
            raise ValueError("Email must be in lowercase.")   
        return v

    # Validate name format
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not NAME_REGEX.fullmatch(v):
            raise ValueError("Name can only contain English letters, numbers, and special characters.")
        return v

# User creation schemas
class UserCreate(UserBase):
    """Schema for creating a new user (includes password)."""
    password: str = Field(min_length=MIN_PW_LEN, max_length=MAX_PW_LEN)

    # Validate password format
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not PW_PATTERN.fullmatch(v):
            raise ValueError("Password can only contain English letters, numbers, and special characters.")
        return v

# User read schemas
class UserRead(UserBase):
    """Base read schema for users returned by the API."""
    user_id: int
    admin_status: bool = False

    # Allows direct SQLAlchemy model validation
    model_config = ConfigDict(from_attributes=True)

# User login schemas
class UserLogin(BaseModel):
    """Schema for user login requests (email and password)."""
    email: EmailStr
    password: str = Field(min_length=MIN_PW_LEN, max_length=MAX_PW_LEN)

    # Validate email format
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip()
        if v.lower().endswith(DEFAULT_EMAIL_DOMAIN) is False:
            raise ValueError(f"Email must be from the {DEFAULT_EMAIL_DOMAIN} domain.")
        return v

    # Validate password format
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        v = v.strip()
        if not PW_PATTERN.fullmatch(v):
            raise ValueError("Password can only contain English letters, numbers, and special characters.")
        return v

# User update schemas
class UserUpdate(BaseModel):
    """Schema for updating user fields. At least one field is required."""
    nickname: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    team: Optional[Teams] = None

    # Validate nickname format
    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not NAME_REGEX.fullmatch(v):
            raise ValueError("Nickname can only contain English letters, numbers, and special characters.")
        return v

    # Validate name format
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not NAME_REGEX.fullmatch(v):
            raise ValueError("Name can only contain English letters, numbers, and special characters.")
        return v

    # Validate email format
    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v.lower().endswith(DEFAULT_EMAIL_DOMAIN):
            raise ValueError(f"Email must be from the {DEFAULT_EMAIL_DOMAIN} domain.")
        return v

    # Validate update is not empty
    @model_validator(mode="after")
    def reject_empty_update(self):
        if not any([self.nickname, self.name, self.email, self.team]):
            raise ValueError("At least one of nickname, name, email, or team must be provided.")
        return self

class UserPasswordUpdate(BaseModel):
    """Schema for updating a user's password."""
    current_password: str
    new_password: str

    # Validate new password format
    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if not PW_PATTERN.fullmatch(v):
            raise ValueError("Password can only contain English letters, numbers, and special characters.")
        return v


