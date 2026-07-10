import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.core.timezone import CST_TZ


class Manufacturer(Base):
    __tablename__ = "manufacturers"

    id = Column(Integer, primary_key=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    speciality = Column(String(255), nullable=True)
    emails = Column(Text, nullable=True)
    phone_number = Column(String(50), nullable=True)
    address = Column(String(500), nullable=True)
    location = Column(String(255), nullable=True)
    public_token = Column(String(64), unique=True, nullable=False, index=True, default=lambda: f"m-{uuid.uuid4().hex}")
    is_active = Column(Boolean, default=True, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(CST_TZ), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.now(CST_TZ), onupdate=datetime.now(CST_TZ))

    quotes = relationship("ManufacturerQuote", back_populates="manufacturer")
    orders = relationship("Order", back_populates="manufacturer", foreign_keys="Order.current_manufacturer_id")
    variant_shares = relationship(
        "DesignVariantManufacturerShare",
        back_populates="manufacturer",
        cascade="all, delete-orphan",
    )


__all__ = ["Manufacturer"]