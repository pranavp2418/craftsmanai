from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_id = Column(String(255), unique=True, index=True, nullable=False)
    hashed_token = Column(String(255), nullable=False)
    device_id = Column(String(255))
    is_active = Column(Boolean, default=True)
    
    # Store the access token JTI associated with this refresh token
    # This allows us to blacklist the old access token during refresh/logout
    access_token_jti = Column(String(255), nullable=True, index=True)
    access_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
    
    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id}, token_id={self.token_id})>"