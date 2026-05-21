from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    emails = Column(String(255), nullable=True)
    phone_number = Column(String(50), nullable=True)
    tag = Column(String(255), nullable=True)
    location = Column(String(500), nullable=True)
    public_token = Column(String(64), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    design_shares = relationship("DesignShare", back_populates="customer", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer")


__all__ = ["Customer"]