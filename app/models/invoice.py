from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="USD")
    pdf_url = Column(String, nullable=True)  # Path or link to download the invoice PDF
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    payment = relationship("Payment", back_populates="invoice")
