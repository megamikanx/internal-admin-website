from sqlalchemy import Column, BigInteger, String, Identity, Integer
from sqlalchemy.orm import relationship

from app.db import Base

DEFAULT_CAPACITY = 8

class room(Base):
    """
    Room model
    """
    __tablename__ = "room"

    # Primary key
    room_id = Column(BigInteger, Identity(start=1), primary_key=True)

    # Other attributes
    building = Column(String, nullable=False, default="성수 오피스", index=True)
    floor = Column(Integer, nullable=False, index=True)
    room_name = Column(String, nullable=False, index=True)
    capacity = Column(Integer, nullable=False, default=DEFAULT_CAPACITY)
    color_hue = Column(Integer, nullable=True)

    # Relationships 
    meetings = relationship(
        "meeting",
        back_populates="room",
        cascade="all, delete-orphan",
    )

    # Google calendar properties
    @property
    def location(self) -> str:
        return f"{self.building}-{self.floor}-{self.room_name} ({self.capacity})"
