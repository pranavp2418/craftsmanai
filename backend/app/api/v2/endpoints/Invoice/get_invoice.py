from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.user import User
from app.models.invoice import Invoice
from app.models.subscription import Payment
from app.schemas.invoice import InvoiceResponse, PaginatedInvoicesResponse

router = APIRouter()

@router.get("/", response_model=PaginatedInvoicesResponse)
async def list_user_invoices(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    page: int = Query(1, ge=1, description="Page number starting from 1"),
    limit: int = Query(20, ge=1, le=100, description="Number of items per page")
) -> PaginatedInvoicesResponse:
    """
    Retrieve all invoices generated for the current authenticated user with pagination.
    """
    try:
        offset = (page - 1) * limit

        # Count total records for pagination info
        count_query = (
            select(func.count(Invoice.id))
            .join(Payment)
            .where(Payment.user_id == current_user.id)
        )
        count_result = await db.execute(count_query)
        total_count = count_result.scalar_one()

        # Retrieve paginated invoices
        query = (
            select(Invoice)
            .join(Payment)
            .where(Payment.user_id == current_user.id)
            .order_by(Invoice.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await db.execute(query)
        invoices = result.scalars().all()

        # Dynamically set the PDF download URL for each invoice if not stored
        for invoice in invoices:
            if not invoice.pdf_url:
                invoice.pdf_url = f"/api/v2/invoices/payment/{invoice.payment_id}/download"

        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0
        has_next = page < total_pages
        has_prev = page > 1

        return {
            "success": True,
            "data": invoices,
            "pagination": {
                "currentPage": page,
                "totalPages": total_pages,
                "totalCount": total_count,
                "limit": limit,
                "hasNext": has_next,
                "hasPrev": has_prev
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve invoices: {str(e)}"
        )



@router.get("/payment/{payment_id}", response_model=InvoiceResponse)
async def get_payment_invoice(
    payment_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> InvoiceResponse:
    """
    Retrieve invoice details for a specific payment.
    """
    try:
        query = (
            select(Invoice)
            .join(Payment)
            .where(
                Invoice.payment_id == payment_id,
                Payment.user_id == current_user.id
            )
        )
        result = await db.execute(query)
        invoice = result.scalar_one_or_none()

        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")

        # Dynamically set the PDF download URL if not stored
        if not invoice.pdf_url:
            invoice.pdf_url = f"/api/v2/invoices/payment/{invoice.payment_id}/download"

        return invoice
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve invoice: {str(e)}"
        )
