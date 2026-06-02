from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
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

@router.get("/payment/{payment_id}/download", response_class=StreamingResponse)
async def download_invoice_pdf(
    payment_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> StreamingResponse:
    """
    Download PDF invoice for a specific payment.
    This endpoint is optimized for browser download and FastAPI docs.
    """
    try:
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
        
        # Generate PDF invoice with new layout
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        
        # Get styles
        styles = getSampleStyleSheet()
        story = []

        # -----------------------------
        # HEADER (Company + Invoice Info)
        # -----------------------------
        header_data = [
            [
                Paragraph(
                    f"""
                    <b>Craftsmen</b><br/>
                    1 Main St.<br/>
                    Beverly Hills, CA<br/>
                    Phone: +1 (800) 555-5555<br/>
                    {payment.user.email}
                    """,
                    styles["Normal"]
                ),
                Paragraph(
                    f"""
                    <b>Invoice #{payment.invoice_id}</b><br/>
                    Date: {payment.created_at.strftime("%d/%m/%Y")}<br/>
                    Status: {payment.status.value}
                    """,
                    ParagraphStyle(name="Right", alignment=TA_RIGHT)
                )
            ]
        ]

        header_table = Table(header_data, colWidths=[3.5 * inch, 2.5 * inch])
        story.append(header_table)
        story.append(Spacer(1, 20))

        # -----------------------------
        # INVOICED TO
        # -----------------------------
        story.append(Paragraph("<b>Invoiced To</b>", styles["Heading3"]))
        story.append(Spacer(1, 8))

        story.append(Paragraph(
            f"""
            {payment.user.full_name or "N/A"}<br/>
            {payment.user.email}<br/>
            Customer ID: {payment.stripe_customer_id or "N/A"}
            """,
            styles["Normal"]
        ))
        story.append(Spacer(1, 20))

        # -----------------------------
        # MAIN ITEM TABLE (2 columns)
        # -----------------------------
        plan_name = payment.plan.name if payment.plan else "Plan"

        items_table = Table([
            ["Description", "Total"],
            [plan_name, f"USD ${float(payment.amount):.2f}"],
        ], colWidths=[4.5 * inch, 1.5 * inch])

        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.black),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (1, 1), (1, -1), "RIGHT"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]))

        story.append(items_table)
        story.append(Spacer(1, 20))

        # -----------------------------
        # TOTALS (RIGHT SIDE BLOCK)
        # -----------------------------
        subtotal = float(payment.amount)
        credit = 0.00
        total = subtotal - credit

        totals_table = Table([
            ["Sub Total", f"USD ${subtotal:.2f}"],
            ["Credit", f"USD ${credit:.2f}"],
            ["Total", f"USD ${total:.2f}"],
        ], colWidths=[4.5 * inch, 1.5 * inch])

        totals_table.setStyle(TableStyle([
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ]))

        story.append(totals_table)
        story.append(Spacer(1, 30))

        # -----------------------------
        # TRANSACTIONS
        # -----------------------------
        story.append(Paragraph("<b>Transactions</b>", styles["Heading3"]))
        story.append(Spacer(1, 10))

        txn_table = Table([
            ["Date", "Transaction ID", "Amount"],
            [
                payment.created_at.strftime("%d/%m/%Y"),
                payment.stripe_customer_id or "N/A",
                f"USD ${total:.2f}"
            ]
        ], colWidths=[2 * inch, 3 * inch, 1 * inch])

        txn_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.black),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ALIGN", (2, 1), (2, -1), "RIGHT"),
        ]))

        story.append(txn_table)
        story.append(Spacer(1, 30))

        # -----------------------------
        # FOOTER
        # -----------------------------
        story.append(Paragraph(
            f"PDF Generated on {payment.created_at.strftime('%d/%m/%Y')}",
            styles["Normal"]
        ))
        story.append(Paragraph(
            "Powered by Fonix",
            styles["Normal"]
        ))
        
        # Build PDF
        doc.build(story)
        
        # Get PDF data
        buffer.seek(0)
        pdf_data = buffer.getvalue()
        buffer.close()
        
        # Return PDF response with attachment disposition for better download support
        filename = f"invoice_{payment.invoice_id}.pdf"
        
        def iterfile():
            yield pdf_data
        
        return StreamingResponse(
            iterfile(),
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
        
        filename = f"payment_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
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
