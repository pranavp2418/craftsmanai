from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.core.timezone import now as tz_now
import logging
import csv
from io import StringIO, BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from app.api import deps
from app.models.user import User
from app.models.subscription import Payment

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/payment/{payment_id}/download")
async def download_invoice_pdf(
    payment_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Download PDF invoice for a specific payment.
    Redirects to the Supabase storage URL if pre-generated, or generates the
    premium invoice template on the fly.
    """
    try:
        from app.models.invoice import Invoice
        from app.services.invoice_service import generate_invoice_pdf_bytes

        # Get payment with plan details
        query = select(Payment).options(
            selectinload(Payment.plan),
            selectinload(Payment.user)
        ).where(
            Payment.id == payment_id,
            Payment.user_id == current_user.id
        )
        
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Check if invoice record exists with pre-generated Supabase URL
        query_invoice = select(Invoice).where(Invoice.payment_id == payment_id)
        result_invoice = await db.execute(query_invoice)
        invoice = result_invoice.scalar_one_or_none()
        
        if invoice and invoice.pdf_url and invoice.pdf_url.startswith("http"):
            import httpx
            logger.info(f"Fetching pre-generated Supabase invoice PDF from: {invoice.pdf_url}")
            async with httpx.AsyncClient() as client:
                response = await client.get(invoice.pdf_url)
                if response.status_code == 200:
                    pdf_bytes = response.content
                    filename = f"invoice_{payment.invoice_id or payment_id}.pdf"
                    from fastapi.responses import Response
                    return Response(
                        content=pdf_bytes,
                        media_type="application/pdf",
                        headers={
                            "Content-Disposition": f"attachment; filename={filename}"
                        }
                    )
                else:
                    logger.warning(f"Failed to fetch invoice from Supabase (status {response.status_code}), falling back to local generation.")


        # Fallback: Generate PDF invoice using the official layout template
        logger.info(f"Generating ad-hoc PDF for invoice {payment.invoice_id or payment_id}")
        pdf_bytes = generate_invoice_pdf_bytes(payment, db.sync_session)
        
        filename = f"invoice_{payment.invoice_id or payment_id}.pdf"
        
        from fastapi.responses import Response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate invoice PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate invoice PDF: {str(e)}")



@router.get("/payments/export", response_class=StreamingResponse)
async def export_all_payments(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> StreamingResponse:
    """
    Export ALL payment history as CSV file.
    """
    try:
        # Get all payments for the user
        query = select(Payment).options(
            selectinload(Payment.plan),
            selectinload(Payment.user)
        ).where(Payment.user_id == current_user.id).order_by(Payment.created_at.desc())
        
        result = await db.execute(query)
        payments = result.scalars().all()
        
        # Create CSV content
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Payment ID',
            'Invoice ID',
            'Amount',
            'Currency',
            'Status',
            'Payment Method',
            'Stripe Customer ID',
            'Plan Name',
            'Plan Description',
            'Created Date'
        ])
        
        # Write payment data
        for payment in payments:
            writer.writerow([
                payment.id,
                payment.invoice_id,
                payment.amount,
                payment.currency,
                payment.status.value,
                payment.payment_method or 'N/A',
                payment.stripe_customer_id or 'N/A',
                payment.plan.name if payment.plan else 'N/A',
                payment.plan.description if payment.plan else 'N/A',
                payment.created_at.strftime('%Y-%m-%d %H:%M:%S') if payment.created_at else 'N/A'
            ])
        
        # Prepare response
        csv_content = output.getvalue()
        output.close()
        
        filename = f"payment_history_{tz_now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        def iterfile():
            yield csv_content.encode('utf-8')
        
        return StreamingResponse(
            iterfile(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export payment history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export payment history: {str(e)}")
