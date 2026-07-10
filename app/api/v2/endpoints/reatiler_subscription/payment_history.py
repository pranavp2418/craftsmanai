from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, String, and_
from datetime import datetime
from app.core.timezone import now as tz_now
import logging
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from app.core.dependencies import get_db, get_current_user, get_current_active_user
from app.models.user import User
from app.models.subscription import Payment, PaymentStatus

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/payment-history")
def get_payment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None)
) -> Any:
    """
    Get payment history for the current user.
    Supports pagination, search, and multiple filters.
    """
    try:
        offset = (page - 1) * limit
        
        # Build base query
        query = db.query(Payment).filter(Payment.user_id == current_user.id)
        
        # Build filters list
        filters = []
        
        # Status Filter
        if status:
            try:
                payment_status = PaymentStatus(status.upper())
                filters.append(Payment.status == payment_status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        
        # Payment Method Filter
        if payment_method:
            filters.append(Payment.payment_method.ilike(f"%{payment_method}%"))
        
        # Date Range Filter
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date)
                filters.append(Payment.created_at >= start_datetime)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid start_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)")
        
        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date)
                filters.append(Payment.created_at <= end_datetime)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid end_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)")
        
        # Amount Range Filter
        if min_amount is not None:
            filters.append(Payment.amount >= min_amount)
        
        if max_amount is not None:
            filters.append(Payment.amount <= max_amount)
        
        # Global Search Filter
        if search:
            search_term = f"%{search}%"
            filters.append(
                or_(
                    Payment.invoice_id.ilike(search_term),
                    Payment.payment_method.ilike(search_term),
                    Payment.stripe_customer_id.ilike(search_term),
                    Payment.stripe_payment_intent_id.ilike(search_term),
                    cast(Payment.amount, String).ilike(search_term),
                    cast(Payment.status, String).ilike(search_term),
                )
            )
        
        # Apply all filters
        if filters:
            query = query.filter(and_(*filters))
        
        total_count = query.count()
        payments = query.order_by(Payment.created_at.desc()).offset(offset).limit(limit).all()
        
        # Format payment data
        payment_history = []
        for payment in payments:
            payment_data = {
                "id": str(payment.id),
                "invoiceId": payment.invoice_id,
                "amount": float(payment.amount),
                "currency": payment.currency,
                "status": payment.status.value,
                "paymentMethod": payment.payment_method,
                # "stripeSessionId": payment.stripe_session_id,
                # "stripePaymentIntentId": payment.stripe_payment_intent_id,
                # "stripeCustomerId": payment.stripe_customer_id,
                "createdAt": payment.created_at.isoformat() if payment.created_at else None,
                "updatedAt": payment.updated_at.isoformat() if payment.updated_at else None,
                "plan": None
            }
            
            # Add plan details if available
            if payment.plan:
                payment_data["plan"] = {
                    "id": str(payment.plan.id),
                    "name": payment.plan.name,
                    "description": payment.plan.description,
                    "price": float(payment.plan.price) if payment.plan.price else None,
                    "monthlyPrice": float(payment.plan.monthly_price) if payment.plan.monthly_price else None,
                    "yearlyPrice": float(payment.plan.yearly_price) if payment.plan.yearly_price else None
                }
            
            payment_history.append(payment_data)
        
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1
        
        return {
            "success": True,
            "data": {
                "payments": payment_history,
                "pagination": {
                    "currentPage": page,
                    "totalPages": total_pages,
                    "totalCount": total_count,
                    "limit": limit,
                    "hasNext": has_next,
                    "hasPrev": has_prev
                }
            },
            "lastUpdated": tz_now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch payment history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch payment history: {str(e)}")


@router.get("/payment/{payment_id}")
def get_payment_details(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Generate and return PDF invoice for a specific payment.
    """
    try:
        payment = db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == current_user.id
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Generate PDF invoice
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        
        story = []
        
        # Title
        story.append(Paragraph("INVOICE", title_style))
        story.append(Spacer(1, 20))
        
        # Company and Invoice Info
        company_info = [
            ["Company:", payment.user.full_name if payment.user.full_name else "Fonix Craftmen"],
            ["Retailer ID:", str(payment.user.id)],
            ["Email:", payment.user.email],
            ["WhatsApp:", payment.user.whatsapp_number or "N/A"],
            ["Contact:", "N/A"]
        ]
        
        invoice_info = [
            ["Invoice ID:", payment.invoice_id],
            ["Invoice Date:", payment.created_at.strftime("%B %d, %Y") if payment.created_at else "N/A"],
            ["Payment Status:", payment.status.value],
            ["Payment Method:", payment.payment_method or "Credit Card"],
            ["Customer ID:", payment.stripe_customer_id or "N/A"]
        ]
        
        company_table = Table(company_info, colWidths=[1.5*inch, 4*inch])
        company_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        
        invoice_table = Table(invoice_info, colWidths=[1.5*inch, 4*inch])
        invoice_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        
        story.append(company_table)
        story.append(Spacer(1, 20))
        story.append(invoice_table)
        story.append(Spacer(1, 30))
        
        # Bill To Section
        story.append(Paragraph("Bill To:", styles['Heading2']))
        story.append(Spacer(1, 10))
        
        bill_to_info = [
            ["Name:", payment.user.email],
            ["Customer ID:", payment.stripe_customer_id or "N/A"],
            ["Email:", payment.user.email]
        ]
        
        bill_to_table = Table(bill_to_info, colWidths=[1.5*inch, 4*inch])
        bill_to_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        
        story.append(bill_to_table)
        story.append(Spacer(1, 30))
        
        # Invoice Items
        story.append(Paragraph("Invoice Items:", styles['Heading2']))
        story.append(Spacer(1, 10))
        
        plan_name = payment.plan.name if payment.plan else "Unknown Plan"
        plan_description = payment.plan.description if payment.plan else "No description available"
        
        items_data = [
            ["Description", "Quantity", "Unit Price", "Total"],
            [plan_name, "1", f"${float(payment.amount):.2f}", f"${float(payment.amount):.2f}"],
            ["", "", "", ""],
            ["", "", "Subtotal:", f"${float(payment.amount):.2f}"],
            ["", "", "Tax:", "$0.00"],
            ["", "", "Total:", f"${float(payment.amount):.2f}"]
        ]
        
        items_table = Table(items_data, colWidths=[3*inch, 1*inch, 1.5*inch, 1.5*inch])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (2, -3), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTNAME', (0, -3), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('BACKGROUND', (0, 1), (-1, 1), colors.beige),
            ('BACKGROUND', (0, -3), (-1, -1), colors.lightgrey),
        ]))
        
        story.append(items_table)
        story.append(Spacer(1, 30))
        
        # Additional Notes
        if plan_description:
            story.append(Paragraph("Notes:", styles['Heading2']))
            story.append(Spacer(1, 10))
            story.append(Paragraph(plan_description, styles['Normal']))
            story.append(Spacer(1, 20))
        
        story.append(Paragraph("Thank you for your business!", styles['Normal']))
        story.append(Spacer(1, 10))
        story.append(Paragraph("This is a computer-generated invoice. No signature is required.", styles['Normal']))
        
        # Build PDF
        doc.build(story)
        
        buffer.seek(0)
        pdf_data = buffer.getvalue()
        buffer.close()
        
        filename = f"invoice_{payment.invoice_id}.pdf"
        
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate invoice PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate invoice PDF: {str(e)}")
