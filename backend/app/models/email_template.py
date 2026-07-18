# app/models/email_template.py

import uuid
from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    key = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)

    subject = Column(String(255), nullable=False)
    html_content = Column(Text, nullable=False)
    text_content = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )