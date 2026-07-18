import csv
from io import StringIO, BytesIO
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
import uuid
import httpx

from app.core.dependencies import get_db, get_current_superuser as get_current_admin
from app.models.user import User
from app.models.subscription import Payment, PaymentStatus, SubscriptionPlan, TopupPack, UserSubscription, SubscriptionStatus
from app.models.invoice import Invoice
from app.services.invoice_service import generate_invoice_pdf_bytes

router = APIRouter()


@router.get("/")
def read_payment_history(
    *,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Number of records per page"),
    status: Optional[PaymentStatus] = None,
    search: Optional[str] = Query(None, description="Search across invoice ID, retailer name / email / business name, and plan name"),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Retrieve payment history. (Admin only)

    Filters:
    - status: Filter by payment status (PAID, PENDING, FAILED, REFUNDED). Omit for All.
    - search: Search across invoice ID, retailer name / email / business name, and plan name.
    """
    # Build base query with joins
    query = (
        db.query(
            Payment,
            User.full_name.label("retailer_name"),
            User.email.label("retailer_email"),
            User.business_name.label("retailer_business"),
            SubscriptionPlan.name.label("plan_name")
        )
        .outerjoin(User, Payment.user_id == User.id)
        .outerjoin(SubscriptionPlan, Payment.plan_id == SubscriptionPlan.id)
    )

    # --- status filter (None = All) ---
    if status is not None:
        query = query.filter(Payment.status == status)

    # --- parallel search across all relevant fields ---
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Payment.invoice_id.ilike(term),
                User.full_name.ilike(term),
                User.email.ilike(term),
                User.business_name.ilike(term),
                SubscriptionPlan.name.ilike(term),
                Payment.payment_method.ilike(term),
            )
        )

    # Count after filters so pagination total is accurate
    total_count = query.count()

    if total_count == 0:
        return {"success": True, "data": [], "total": 0}

    offset = (page - 1) * limit

    payments_data = (
        query
        .order_by(desc(Payment.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    response_data = []
    for row in payments_data:
        payment = row[0]
        retailer_name = row[1] or row[2] or row[3]   # full_name → email → business_name
        plan_name = row[4]

        payment_dict = {
            "id": payment.id,
            "invoice_id": payment.invoice_id,
            "user_id": payment.user_id,
            "plan_id": payment.plan_id,
            "amount": payment.amount,
            "currency": payment.currency,
            "status": payment.status.value if hasattr(payment.status, 'value') else payment.status,
            "payment_method": payment.payment_method or "N/A",
            "created_at": payment.created_at,
            "retailer_name": retailer_name or "Unknown Retailer",
            "plan_name": plan_name or "Unknown Plan"
        }
        response_data.append(payment_dict)

    from math import ceil
    total_pages = ceil(total_count / limit) if limit > 0 else 1
    has_next = page < total_pages
    has_prev = page > 1

    return {
        "success": True,
        "data": response_data,
        "total": total_count,
        "page": page,
        "total_pages": total_pages,
        "has_next": has_next,
        "has_prev": has_prev
    }


@router.get("/export")
def export_payment_history_csv(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Response:
    """
    Export all payment history to a CSV file. (Admin only)
    """
    payments_data = (
        db.query(
            Payment,
            User.full_name.label("retailer_name"),
            SubscriptionPlan.name.label("plan_name")
        )
        .outerjoin(User, Payment.user_id == User.id)
        .outerjoin(SubscriptionPlan, Payment.plan_id == SubscriptionPlan.id)
        .order_by(desc(Payment.created_at))
        .all()
    )
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Invoice ID", "Retailer", "Plan", 
        "Amount", "Currency", "Status", "Payment Method"
    ])
    
    for row in payments_data:
        payment, retailer_name, plan_name = row
        writer.writerow([
            payment.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            payment.invoice_id,
            retailer_name or "Unknown Retailer",
            plan_name or "Unknown Plan",
            payment.amount,
            payment.currency,
            payment.status.value if hasattr(payment.status, 'value') else payment.status,
            payment.payment_method or "N/A"
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=payment_history_export.csv"
        }
    )


@router.get("/{payment_id}")
def get_payment_detail(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Get detailed information about a specific payment. (Admin only)
    """
    data = (
        db.query(
            Payment,
            User.full_name.label("retailer_name"),
            SubscriptionPlan.name.label("plan_name")
        )
        .outerjoin(User, Payment.user_id == User.id)
        .outerjoin(SubscriptionPlan, Payment.plan_id == SubscriptionPlan.id)
        .filter(Payment.id == payment_id)
        .first()
    )
    
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
        
    payment, retailer_name, plan_name = data
    
    return {
        "success": True,
        "data": {
            "id": payment.id,
            "invoice_id": payment.invoice_id,
            "user_id": payment.user_id,
            "plan_id": payment.plan_id,
            "amount": payment.amount,
            "currency": payment.currency,
            "status": payment.status.value if hasattr(payment.status, 'value') else payment.status,
            "payment_method": payment.payment_method or "N/A",
            "stripe_session_id": payment.stripe_session_id,
            "stripe_payment_intent_id": payment.stripe_payment_intent_id,
            "created_at": payment.created_at,
            "updated_at": payment.updated_at,
            "retailer_name": retailer_name or "Unknown Retailer",
            "plan_name": plan_name or "Unknown Plan"
        }
    }


@router.get("/{payment_id}/download")
def download_payment_history(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Response:
    """
    Download a specific payment invoice. (Admin only)
    
    Downloads PDF from Supabase if available, otherwise generates PDF on-the-fly.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Fetch payment with invoice information
    data = (
        db.query(
            Payment,
            User.full_name.label("retailer_name"),
            SubscriptionPlan.name.label("plan_name"),
            Invoice.pdf_url
        )
        .outerjoin(User, Payment.user_id == User.id)
        .outerjoin(SubscriptionPlan, Payment.plan_id == SubscriptionPlan.id)
        .outerjoin(Invoice, Payment.id == Invoice.payment_id)
        .filter(Payment.id == payment_id)
        .first()
    )
    
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
        
    payment, retailer_name, plan_name, pdf_url = data
    
    # If PDF URL exists (Supabase), download and return the PDF
    if pdf_url:
        try:
            logger.info(f"Attempting to download PDF from: {pdf_url}")
            response = httpx.get(pdf_url, follow_redirects=True, timeout=10.0)
            logger.info(f"PDF download status: {response.status_code}")
            
            if response.status_code == 200:
                pdf_bytes = response.content
                logger.info(f"PDF downloaded successfully from Supabase, size: {len(pdf_bytes)} bytes, content-type: {response.headers.get('content-type', 'unknown')}")
                filename = f"invoice_{payment.invoice_id or payment_id}.pdf"
                
                # Verify we actually got PDF content
                if response.headers.get('content-type') == 'application/pdf' or pdf_bytes[:4] == b'%PDF':
                    logger.info(f"Returning PDF response with filename: {filename}")
                    return Response(
                        content=pdf_bytes,
                        media_type="application/pdf",
                        headers={
                            "Content-Disposition": f'attachment; filename="{filename}"',
                            "Cache-Control": "no-cache, no-store, must-revalidate",
                            "Pragma": "no-cache",
                            "Expires": "0",
                            "X-PDF-Source": "supabase"
                        }
                    )
                else:
                    logger.warning(f"Downloaded content is not a PDF, content-type: {response.headers.get('content-type')}, first bytes: {pdf_bytes[:20]}")
            else:
                logger.warning(f"PDF download returned status {response.status_code}")
        except Exception as e:
            logger.error(f"Error downloading PDF: {str(e)}")
            # Fall back to PDF generation
    
    # Generate PDF on-the-fly as fallback
    try:
        logger.info("Generating PDF on-the-fly")
        
        # Query additional data needed for PDF generation
        topup_pack = None
        if payment.topup_pack_id:
            topup_pack = db.query(TopupPack).filter(TopupPack.id == payment.topup_pack_id).first()
        
        # Get active subscription for billing period
        active_sub = None
        if payment.user_id:
            active_sub = db.query(UserSubscription).filter(
                UserSubscription.user_id == payment.user_id,
                UserSubscription.status == SubscriptionStatus.ACTIVE
            ).first()
        
        # Attach to payment object for PDF generation
        payment._topup_pack = topup_pack
        payment._active_sub = active_sub
        
        # Generate PDF
        pdf_bytes = generate_invoice_pdf_bytes(payment, db)
        logger.info(f"PDF generated successfully, size: {len(pdf_bytes)} bytes")
        
        filename = f"invoice_{payment.invoice_id or payment_id}.pdf"
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download or generate invoice PDF: {str(e)}"
        )
