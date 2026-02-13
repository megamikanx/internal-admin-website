from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, func, Enum as SAEnum, text, Identity
from sqlalchemy.orm import relationship

from app.db import Base
from app.core.enums import DrinkOrderStatus

class drink_order(Base):
    """
    Drink order model
    """
    __tablename__ = "drink_order"

    # Primary key
    order_id = Column(BigInteger, Identity(start=1), primary_key=True)
    
    # Foreign keys 
    user_id = Column(BigInteger, ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False)
    reviewed_by = Column(BigInteger, ForeignKey("user.user_id", ondelete="SET NULL"), nullable=True)

    # Other attributes
    drink_name = Column(String, nullable=False)
    product_url = Column(String, nullable=False)
    status = Column(
        SAEnum(DrinkOrderStatus, name="drink_order_status"),
        nullable=False,
        server_default=text("'pending'"),
        index=True,
    )
    submitted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reason = Column(String, nullable=True)

    # Relationships
    user = relationship("user", foreign_keys=[user_id], back_populates="drink_orders_submitted")
    reviewer = relationship("user", foreign_keys=[reviewed_by], back_populates="drink_orders_reviewed")
