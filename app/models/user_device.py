from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_name = Column(String(255))
    device_type = Column(String(100))  # mobile, desktop, tablet, etc.
    device_id = Column(String(255), index=True)  # Unique device identifier
    user_agent = Column(Text)
    ip_address = Column(String(45))
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="devices")
    
    def __repr__(self):
        return f"<UserDevice(id={self.id}, user_id={self.user_id}, device_type={self.device_type})>"
