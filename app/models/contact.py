"""
ContactSubmission model - stores contact form submissions from the public website.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
from app.core.timezone import CST_TZ


class ContactSubmission(Base):
    __tablename__ = "contact_submissions"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    business_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    store_type = Column(String(255), nullable=True)
    interest = Column(Text, nullable=True)

    # Tracking
    email_sent = Column(Boolean, default=False, nullable=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), onupdate=lambda: datetime.now(CST_TZ))

    def __repr__(self):
        return f"<ContactSubmission(id={self.id}, name={self.full_name}, email={self.email})>"