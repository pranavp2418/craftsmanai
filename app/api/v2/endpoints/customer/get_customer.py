from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

from app.core.dependencies import get_db, get_current_user
from app.schemas.customer import (
    CustomerDetailResponse,
    CustomerResponse,
    CustomerStats,
    LinkedProject,
    TimelineActivity,
    CustomerTag,
)
from app.services.customer_service import CustomerService
from app.models.user import User
from app.models.design import DesignShare, DesignShareStatus
from app.models.order import Order, ManufacturerQuote

router = APIRouter()


@router.get("/{customer_id}", response_model=CustomerDetailResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = CustomerService(db)
    customer = service.get_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # 1. Fetch design shares linked to this customer
    shares = db.query(DesignShare).filter(DesignShare.customer_id == customer.id).all()

    # 2. Build linked projects list
    linked_projects = []
    for share in shares:
        design = share.design
        if design:
            linked_projects.append(
                LinkedProject(
                    id=design.id,
                    design_code=design.design_code,
                    name=design.name,
                    jewellery_type=design.jewellery_type,
                    status="Awaiting Approval" if share.status == DesignShareStatus.PENDING else "Shared with Customer",
                    thumbnail_url=design.input_image_url,
                )
            )

    # 3. Generate dynamic activity timeline from database states
    timeline = []
    interaction_dates = [customer.created_at]

    for share in shares:
        design = share.design
        if not design:
            continue
        
        # Design shared event
        timeline.append(
            TimelineActivity(
                id=share.id,
                action_type="Design shared",
                message=f"{design.design_code} {design.jewellery_type or 'Design'} render sent for review",
                created_at=share.created_at,
            )
        )
        interaction_dates.append(share.created_at)

        # Feedback/Approval event
        if share.status != DesignShareStatus.PENDING:
            action = "Feedback received"
            msg = f"{design.design_code} {design.jewellery_type or 'Design'} — {share.comment or 'requested adjustments'}"
            if share.status == DesignShareStatus.ACCEPTED:
                action = "Design approved"
                msg = f"{design.design_code} {design.jewellery_type or 'Design'} — approved by customer"
            
            ref_date = share.reviewed_at or share.created_at
            timeline.append(
                TimelineActivity(
                    id=1000 + share.id,
                    action_type=action,
                    message=msg,
                    created_at=ref_date,
                )
            )
            interaction_dates.append(ref_date)

        # Order creation event
        if share.order:
            order = share.order
            timeline.append(
                TimelineActivity(
                    id=2000 + order.id,
                    action_type="New request",
                    message=f"{design.design_code} {design.jewellery_type or 'Design'} request created",
                    created_at=order.created_at,
                )
            )
            interaction_dates.append(order.created_at)

    # Sort timeline by created_at descending
    timeline.sort(key=lambda x: x.created_at, reverse=True)

    # 4. Compute statistics
    total_requests = len(shares)
    active_projects = len([p for p in linked_projects if p.status != "COMPLETED" and p.status != "REJECTED"])
    
    # Calculate total spent from accepted quotes on orders
    total_spent = 0.0
    for share in shares:
        if share.order:
            for quote in share.order.quotes:
                if quote.status.value == "ACCEPTED" or quote.status == "ACCEPTED":
                    total_spent += (quote.cost_price or 0.0)

    last_interaction = max(interaction_dates) if interaction_dates else customer.created_at

    stats = CustomerStats(
        total_requests=total_requests,
        active_projects=active_projects,
        total_spent=total_spent,
        last_interaction=last_interaction,
    )

    # Parse emails JSON
    emails = []
    if customer.emails:
        try:
            parsed = json.loads(customer.emails)
            if isinstance(parsed, list):
                emails = parsed
        except Exception:
            emails = [{"label": "Work", "email": customer.emails}]

    # Strict tag parsing
    tag_val = None
    if customer.tag:
        try:
            tag_val = CustomerTag(customer.tag)
        except ValueError:
            tag_val = None

    return {
        "id": customer.id,
        "created_by_user_id": customer.created_by_user_id,
        "full_name": customer.full_name,
        "tag": tag_val,
        "emails": emails,
        "phone_number": customer.phone_number,
        "location": customer.location,
        "status": "Active" if customer.is_active else "Inactive",
        "public_token": customer.public_token,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at,
        "client_since": customer.created_at,
        "last_interaction": last_interaction,
        "stats": stats,
        "linked_projects": linked_projects,
        "timeline": timeline,
    }
