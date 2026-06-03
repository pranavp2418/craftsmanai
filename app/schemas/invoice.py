from pydantic import BaseModel, UUID4, ConfigDict
from decimal import Decimal
from datetime import datetime
from typing import Optional

class InvoiceBase(BaseModel):
    invoice_number: str
    payment_id: UUID4
    amount: Decimal
    currency: str = "USD"
    pdf_url: Optional[str] = None
    created_at: datetime

class InvoiceResponse(InvoiceBase):
    id: UUID4

    model_config = ConfigDict(from_attributes=True)


class InvoicePaginationDetails(BaseModel):
    currentPage: int
    totalPages: int
    totalCount: int
    limit: int
    hasNext: bool
    hasPrev: bool


class PaginatedInvoicesResponse(BaseModel):
    success: bool
    data: list[InvoiceResponse]
    pagination: InvoicePaginationDetails

