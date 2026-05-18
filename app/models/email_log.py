
import uuid
from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class EmailStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Email details
    to_email = Column(String(255), nullable=False, index=True)
    template_name = Column(String(100), nullable=False, index=True)
    subject = Column(String(255), nullable=True)
    
    # Template context (stored as JSON string)
    template_variables = Column(Text, nullable=True)
    
    # Status tracking
    status = Column(
        Enum(EmailStatus), 
        default=EmailStatus.PENDING, 
        nullable=False,
        index=True
    )
    
    # Error information
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    
    # SMTP response (if available)
    smtp_response = Column(Text, nullable=True)
    
    # User association (if email is for a registered user)
    user_id = Column(Integer, nullable=True, index=True)
    
    # Metadata
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self):
        return f"<EmailLog(id={self.id}, to={self.to_email}, template={self.template_name}, status={self.status})>"
