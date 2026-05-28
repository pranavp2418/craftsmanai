from __future__ import annotations

from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DesignStatus(str, Enum):
    DRAFT = "DRAFT"
    GENERATING = "GENERATING"
    GENERATED = "GENERATED"
    UNDER_REVIEW = "UNDER_REVIEW"
    SHARED = "SHARED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PRODUCTION = "IN_PRODUCTION"
    COMPLETED = "COMPLETED"


class Design(Base):
    __tablename__ = "designs"
    __table_args__ = (
        UniqueConstraint("user_id", "sequence_number", name="uq_design_user_sequence"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True, doc="The actual creator (team member) if different from user_id (team owner)")
    design_code = Column(String(32), unique=True, nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    jewellery_type = Column(String(100), nullable=True)
    user_prompt = Column(Text, nullable=True)
    input_image_url = Column(String(500), nullable=True)
    input_image_urls = Column(JSON, nullable=True)
    status = Column(SqlEnum(DesignStatus, native_enum=False, length=32), nullable=False, default=DesignStatus.DRAFT)
    is_archived = Column(Boolean, nullable=False, default=False)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    variants = relationship("DesignVariant", back_populates="design", cascade="all, delete-orphan")
    activity_logs = relationship("DesignActivityLog", back_populates="design", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="design")


class   DesignVariant(Base):
    __tablename__ = "design_variants"
    __table_args__ = (
        UniqueConstraint("design_id", "version_number", name="uq_variant_design_version"),
        UniqueConstraint("design_id", "variant_name", name="uq_variant_design_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    design_id = Column(Integer, ForeignKey("designs.id"), nullable=False, index=True)
    parent_variant_id = Column(Integer, ForeignKey("design_variants.id"), nullable=True)
    variant_name = Column(String(255), nullable=False)
    version_number = Column(Integer, nullable=False, default=0)
    base_design_image_url = Column(String(500), nullable=True)
    angles_json = Column(JSON, nullable=True)
    metal_variations_json = Column(JSON, nullable=True)
    prompt_used = Column(Text, nullable=True)
    model_used = Column(String(255), nullable=True)
    is_selected = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, nullable=False, default=False)
    is_deleted = Column(Boolean, nullable=False, default=False)
    design_focus = Column(String(100), nullable=True)
    style_tags = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    design = relationship("Design", back_populates="variants")
    parent_variant = relationship("DesignVariant", remote_side=[id], backref="child_variants")
    shares = relationship("DesignShare", back_populates="design_variant", cascade="all, delete-orphan")
    manufacturer_shares = relationship("DesignVariantManufacturerShare", back_populates="design_variant", cascade="all, delete-orphan")


class DesignShareStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    NEEDS_REFINEMENT = "NEEDS_REFINEMENT"


class DesignShare(Base):
    __tablename__ = "design_shares"

    id = Column(Integer, primary_key=True, index=True)
    design_variant_id = Column(Integer, ForeignKey("design_variants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    public_token = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(SqlEnum(DesignShareStatus, native_enum=False, length=32), nullable=False, default=DesignShareStatus.PENDING)
    comment = Column(Text, nullable=True)
    allow_feedback = Column(Boolean, default=True, nullable=False)
    allow_review_request = Column(Boolean, default=True, nullable=False)        
    require_approval = Column(Boolean, default=False, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    design_variant = relationship("DesignVariant", back_populates="shares")
    customer = relationship("Customer", back_populates="design_shares")
    order = relationship("Order", back_populates="share", uselist=False)


class ManufacturerShareStatus(str, Enum):
    PENDING = "PENDING"
    QUOTED = "QUOTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class DesignVariantManufacturerShare(Base):
    """Links an approved design variant to a manufacturer for quoting."""

    __tablename__ = "design_variant_manufacturer_shares"

    id = Column(Integer, primary_key=True, index=True)
    design_variant_id = Column(Integer, ForeignKey("design_variants.id"), nullable=False, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=False, index=True)
    public_token = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(SqlEnum(ManufacturerShareStatus, native_enum=False, length=32), nullable=False, default=ManufacturerShareStatus.PENDING)
    cost_price = Column(Float, nullable=True)
    delivery_time_days = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    design_variant = relationship("DesignVariant", back_populates="manufacturer_shares")
    manufacturer = relationship("Manufacturer", back_populates="variant_shares")


class DesignActivityLog(Base):
    __tablename__ = "design_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    design_id = Column(Integer, ForeignKey("designs.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action_type = Column(String(64), nullable=False)
    message = Column(String(500), nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    design = relationship("Design", back_populates="activity_logs")
    user = relationship("User")


__all__ = [
    "Design",
    "DesignVariant",
    "DesignShare",
    "DesignVariantManufacturerShare",
    "DesignActivityLog",
    "DesignStatus",
    "DesignShareStatus",
    "ManufacturerShareStatus",
]