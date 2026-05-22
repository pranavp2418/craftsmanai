import csv
from io import StringIO
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
import uuid

from app.core.dependencies import get_db, get_current_superuser as get_current_admin
from app.models.user import User
from app.models.subscription import Payment, SubscriptionPlan

router = APIRouter()


@router.get("/")
def read_payment_history(
    *,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Retrieve payment history. (Admin only)
    """
    # Count total entries
    total_count = db.query(func.count(Payment.id)).scalar() or 0

    if total_count == 0:
        return {"success": True, "data": [], "total": 0}

    payments_data = (
        db.query(
            Payment,
            User.full_name.label("retailer_name"),
            SubscriptionPlan.name.label("plan_name")
        )
        .outerjoin(User, Payment.user_id == User.id)
        .outerjoin(SubscriptionPlan, Payment.plan_id == SubscriptionPlan.id)
        .order_by(desc(Payment.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    response_data = []
    for row in payments_data:
        payment = row[0]
        retailer_name = row[1]
        plan_name = row[2]
        
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
        
    return {
        "success": True,
        "data": response_data,
        "total": total_count
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
    Download a specific payment record as a CSV file. (Admin only)
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
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Invoice ID", "Retailer", "Plan", 
        "Amount", "Currency", "Status", "Payment Method"
    ])
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
    
    filename = f"payment_{payment.invoice_id or payment_id}.csv"
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
