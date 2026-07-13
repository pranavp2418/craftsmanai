from enum import Enum
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.core.timezone import CST_TZ


class OrderStatus(str, Enum):
    CREATED = "CREATED"
    QUOTED = "QUOTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PRODUCTION = "IN_PRODUCTION"
    COMPLETED = "COMPLETED"


class ManufacturerQuoteStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    design_id = Column(Integer, ForeignKey("designs.id"), nullable=False, index=True)
    share_id = Column(Integer, ForeignKey("design_shares.id"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    current_manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=True, index=True)
    status = Column(SqlEnum(OrderStatus, native_enum=False, length=32), nullable=False, default=OrderStatus.CREATED)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), onupdate=lambda: datetime.now(CST_TZ))

    design = relationship("Design", back_populates="orders")
    share = relationship("DesignShare", back_populates="order")
    customer = relationship("Customer", back_populates="orders")
    manufacturer = relationship("Manufacturer", back_populates="orders", foreign_keys=[current_manufacturer_id])
    quotes = relationship("ManufacturerQuote", back_populates="order", cascade="all, delete-orphan")
    activity_logs = relationship("OrderActivityLog", back_populates="order", cascade="all, delete-orphan")


class ManufacturerQuote(Base):
    __tablename__ = "manufacturer_quotes"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=False, index=True)
    cost_price = Column(Float, nullable=True)
    delivery_time_days = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(SqlEnum(ManufacturerQuoteStatus, native_enum=False, length=32), nullable=False, default=ManufacturerQuoteStatus.SUBMITTED)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), nullable=False)

    order = relationship("Order", back_populates="quotes")
    manufacturer = relationship("Manufacturer", back_populates="quotes")


class OrderActivityLog(Base):
    __tablename__ = "order_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    action_type = Column(String(64), nullable=False)
    message = Column(String(500), nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), nullable=False)

    order = relationship("Order", back_populates="activity_logs")


__all__ = [
    "Order",
    "ManufacturerQuote",
    "OrderActivityLog",
    "OrderStatus",
    "ManufacturerQuoteStatus",
]