from sqlalchemy import Column, BigInteger, String, Boolean, text, Identity, Enum as SAEnum, DateTime
from sqlalchemy.orm import relationship

from app.db import Base
from app.core.enums import Teams

class user(Base):
    """
    User model
    """
    __tablename__ = "user"

    # Primary key
    user_id = Column(BigInteger, Identity(start=1), primary_key=True)

    # Other attributes
    nickname = Column(String, nullable=False, unique=True,index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    admin_status = Column(Boolean, nullable=False, server_default=text("false"))
    password_hash = Column(String, nullable=False)
    team = Column(SAEnum(Teams, name="teams"), nullable=False, index=True)

    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    google_token_expiry = Column(DateTime(timezone=True), nullable=True)
    google_calendar_id = Column(String, nullable=True, index=True)
    google_sync_token = Column(String, nullable=True)

    # Relationships 
    meetings_hosted = relationship(
        "meeting",
        back_populates="host",
        foreign_keys="meeting.user_id",
        cascade="all, delete",
        passive_deletes=True,
    )
    meetings_attending = relationship(
        "meeting",
        secondary="meeting_attendee",
        back_populates="attendees",
    )
    drink_orders_submitted = relationship(
        "drink_order",
        foreign_keys="drink_order.user_id",
        back_populates="user",
        cascade="all, delete",
        passive_deletes=True,
    )
    drink_orders_reviewed = relationship(
        "drink_order",
        foreign_keys="drink_order.reviewed_by",
        back_populates="reviewer",
        cascade="all, delete",
        passive_deletes=True,
    )
