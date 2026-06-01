from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ProductionSheet(Base):
    __tablename__ = "production_sheet"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("design_variants.id"), nullable=False, index=True)
    budget_range = Column(String(100), nullable=True)
    metal_details = Column(JSON, nullable=True)
    stone_type = Column(String(100), nullable=True)
    setting_type = Column(String(100), nullable=True)
    stone_count = Column(Integer, nullable=True)
    stone_size = Column(String(100), nullable=True)
    dimension = Column(JSON, nullable=True)
    manufacturing_notes = Column(Text, nullable=True)
    manufacturing_image = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
    variant = relationship("DesignVariant")
