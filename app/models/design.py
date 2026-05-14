from __future__ import annotations

from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SqlEnum,
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
    design_code = Column(String(32), unique=True, nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    jewellery_type = Column(String(100), nullable=True)
    user_prompt = Column(Text, nullable=True)
    input_image_url = Column(String(500), nullable=True)
    status = Column(SqlEnum(DesignStatus, native_enum=False, length=32), nullable=False, default=DesignStatus.DRAFT)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    variants = relationship("DesignVariant", back_populates="design", cascade="all, delete-orphan")
    shares = relationship("DesignShare", back_populates="design", cascade="all, delete-orphan")
    activity_logs = relationship("DesignActivityLog", back_populates="design", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="design")


class DesignVariant(Base):
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
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    design = relationship("Design", back_populates="variants")
    parent_variant = relationship("DesignVariant", remote_side=[id], backref="child_variants")


class DesignShareStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    NEEDS_REFINEMENT = "NEEDS_REFINEMENT"


class DesignShare(Base):
    __tablename__ = "design_shares"

    id = Column(Integer, primary_key=True, index=True)
    design_id = Column(Integer, ForeignKey("designs.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    public_token = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(SqlEnum(DesignShareStatus, native_enum=False, length=32), nullable=False, default=DesignShareStatus.PENDING)
    comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    design = relationship("Design", back_populates="shares")
    customer = relationship("Customer", back_populates="design_shares")
    order = relationship("Order", back_populates="share", uselist=False)


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
    "DesignActivityLog",
    "DesignStatus",
    "DesignShareStatus",
]