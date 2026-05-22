from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class BrandSetting(Base):
    __tablename__ = "brand_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    
    brand_name = Column(String(255), nullable=True)
    logo_url = Column(String(500), nullable=True)
    business_email = Column(String(255), nullable=True)
    phone_number = Column(String(50), nullable=True)
    primary_color = Column(String(20), default="#6366F1", nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationship
    user = relationship("User", back_populates="brand_setting")

    def __repr__(self):
        return f"<BrandSetting(id={self.id}, user_id={self.user_id}, brand_name={self.brand_name})>"
