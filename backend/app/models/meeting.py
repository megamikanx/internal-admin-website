from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, func, Identity, Enum as SAEnum
from sqlalchemy.sql import text
from sqlalchemy.orm import relationship

from app.db import Base
from app.core.enums import ResponseStatus

class meeting(Base):
    """
    Meeting model
    """
    __tablename__ = "meeting"

    # Primary key
    reservation_id = Column(BigInteger, Identity(start=1), primary_key=True)

    # Foreign keys
    room_id = Column(BigInteger, ForeignKey("room.room_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False) 

    # Other attributes
    title = Column(String, nullable=False, index=True)
    notes = Column(String, nullable=True)
    start_at = Column(DateTime(timezone=True), nullable=True, index=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    google_event_id = Column(String, nullable=True, index=True)
    google_last_synced_at = Column(DateTime(timezone=True), nullable=True)
    google_sync_status = Column(String, nullable=True, index=True)
    
    # Relationships 
    room = relationship("room", back_populates="meetings")
    host = relationship(
        "user",
        back_populates="meetings_hosted",
        foreign_keys=[user_id],
        passive_deletes=True,
    )
    attendees = relationship(
        "user",
        secondary="meeting_attendee",
        back_populates="meetings_attending",
    )

    # Google calendar properties
    @property
    def location(self):
        if not self.room:
            return None
        return (
            f"{self.room.building}-"
            f"{self.room.floor}-"
            f"{self.room.room_name} "
            f"({self.room.capacity})"
        )

class meeting_attendee(Base):
    """
    Meeting attendee association model
    """
    __tablename__ = "meeting_attendee"

    # Foreign keys
    reservation_id = Column(
        BigInteger,
        ForeignKey("meeting.reservation_id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id = Column(
        BigInteger,
        ForeignKey("user.user_id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Other attributes
    response_status = Column(
        SAEnum(ResponseStatus, name="response_status"),
        nullable=False,
        server_default=text("'needsAction'"),
    )

