from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base


class BlacklistedToken(Base):
    """
    Database backup for blacklisted tokens (in addition to Redis)
    This provides persistence and audit trail
    """
    __tablename__ = "blacklisted_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(255), unique=True, index=True, nullable=False)  # JWT ID
    token_type = Column(String(20), nullable=False)  # access, refresh
    user_id = Column(Integer, index=True)  # Optional user_id for user-wide blacklisting
    reason = Column(String(100))  # logout, password_reset, emergency
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)  # Auto-cleanup reference
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_blacklisted_jti_type', 'jti', 'token_type'),
        Index('idx_blacklisted_user_expires', 'user_id', 'expires_at'),
    )
    
    def __repr__(self):
        return f"<BlacklistedToken(jti={self.jti}, type={self.token_type}, user_id={self.user_id})>"
