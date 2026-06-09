from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
import ast
import json

from app.core.dependencies import get_db, get_current_active_user
from app.models.user import User
from app.models.customer import Customer
from app.models.design import DesignShare, DesignVariant
from app.schemas.customer import CustomerDesignShareItem

router = APIRouter()


@router.get("/{variant_id}/design_shares", response_model=List[CustomerDesignShareItem], status_code=status.HTTP_200_OK)
def get_customer_design_shares(
    variant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    ) -> List[Dict[str, Any]]:
    """Return shared-customer rows for a design variant."""

    variant = db.query(DesignVariant).filter(DesignVariant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    rows = (
        db.query(DesignShare, Customer)
        .outerjoin(Customer, Customer.id == DesignShare.customer_id)
        .filter(DesignShare.design_variant_id == variant_id)
        .order_by(DesignShare.created_at.desc())
        .all()
    )

    shares: List[Dict[str, Any]] = []
    for share, customer in rows:
        status_val = share.status.value if hasattr(share.status, "value") else str(share.status)

        emails: List[Any] = []
        if customer and customer.emails:
            try:
                parsed = json.loads(customer.emails)
                if isinstance(parsed, list):
                    emails = parsed
            except Exception:
                try:
                    parsed = ast.literal_eval(customer.emails)
                    if isinstance(parsed, list):
                        emails = parsed
                    elif isinstance(parsed, dict):
                        emails = [parsed]
                    else:
                        emails = [{"label": "Work", "email": customer.emails}]
                except Exception:
                    emails = [{"label": "Work", "email": customer.emails}]

        customer_email: Optional[str] = None
        if emails:
            first_email = emails[0]
            if isinstance(first_email, dict):
                customer_email = first_email.get("email")
            elif first_email is not None:
                customer_email = str(first_email)

        shares.append({
            "customer_name": customer.full_name if customer else "Unknown Customer",
            "email": customer_email,
            "shared_on": share.created_at if share.created_at else None,
            "status": status_val,
            "customer_comment": share.comment,
            "token": share.public_token,
        })

    return shares
