from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

from app.core.dependencies import get_db, get_current_user
from app.schemas.manufacturer import (
    ManufacturerDetailResponse,
    ManufacturerResponse,
    ManufacturerStats,
    SentRequest,
    ProductionStep,
    ManufacturerSpeciality,
)
from app.services.manufacturer_service import ManufacturerService
from app.models.user import User
from app.models.order import Order, ManufacturerQuote, OrderStatus


router = APIRouter()


from app.models.design import DesignVariantManufacturerShare


@router.get("/{manufacturer_id}", response_model=ManufacturerDetailResponse)
def get_manufacturer(
    manufacturer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerService(db)
    manufacturer = service.get_manufacturer(manufacturer_id)
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    # 1. Fetch manufacturer shares linked to this manufacturer
    shares = db.query(DesignVariantManufacturerShare).filter(
        DesignVariantManufacturerShare.manufacturer_id == manufacturer.id
    ).all()

    # 2. Build sent requests
    sent_requests = []
    for share in shares:
        variant = share.design_variant
        design = variant.design if variant else None
        if design:
            status_str = "Pending"
            share_status = share.status.value if hasattr(share.status, "value") else str(share.status)
            if share_status == "ACCEPTED":
                status_str = "Accepted"
            elif share_status == "REJECTED":
                status_str = "Rejected"
            elif share_status == "QUOTED":
                status_str = "Quoted"
                
            sent_requests.append(
                SentRequest(
                    id=share.id,
                    design_code=design.design_code,
                    name=design.name,
                    jewellery_type=design.jewellery_type,
                    status=status_str,
                    created_at=share.created_at,
                    thumbnail_url=design.input_image_url,
                )
            )

    # 3. Dynamic production timeline
    production_timeline = []
    activity_dates = [manufacturer.created_at]

    for share in shares:
        variant = share.design_variant
        design = variant.design if variant else None
        if not design:
            continue
            
        # Request Sent step
        production_timeline.append(
            ProductionStep(
                id=share.id,
                action_type="Request Sent",
                message=f"Request for {design.design_code} {design.jewellery_type or 'Design'} sent to manufacturer",
                created_at=share.created_at,
            )
        )
        activity_dates.append(share.created_at)

        # Quotes/Approved steps
        share_status = share.status.value if hasattr(share.status, "value") else str(share.status)
        if share_status in ("QUOTED", "ACCEPTED"):
            production_timeline.append(
                ProductionStep(
                    id=1000 + share.id,
                    action_type="Quote Submitted",
                    message=f"Cost quote of ${share.cost_price or 0:,.2f} submitted",
                    created_at=share.created_at,
                )
            )
            activity_dates.append(share.created_at)
            
            if share_status == "ACCEPTED":
                production_timeline.append(
                    ProductionStep(
                        id=2000 + share.id,
                        action_type="Approved",
                        message="Quote approved, entered active production phase",
                        created_at=share.created_at,
                    )
                )
                activity_dates.append(share.created_at)

    # Sort production timeline by created_at descending
    production_timeline.sort(key=lambda x: x.created_at, reverse=True)

    # 4. Compute statistics
    total_requests = len(shares)
    completed_requests = len([
        s for s in shares 
        if (s.status.value if hasattr(s.status, "value") else str(s.status)) == "ACCEPTED"
    ])
    pending_requests = len([
        s for s in shares 
        if (s.status.value if hasattr(s.status, "value") else str(s.status)) in ("PENDING", "QUOTED")
    ])

    total_profit = 0.0
    for s in shares:
        s_status = s.status.value if hasattr(s.status, "value") else str(s.status)
        if s_status == "ACCEPTED":
            total_profit += (s.cost_price or 0.0)

    last_activity = max(activity_dates) if activity_dates else manufacturer.created_at

    stats = ManufacturerStats(
        total_requests=total_requests,
        completed_requests=completed_requests,
        total_profit=total_profit,
        pending_requests=pending_requests,
        avg_response_time="18 hrs",
        last_activity=last_activity,
    )

    # Parse emails
    emails = []
    if manufacturer.emails:
        try:
            parsed = json.loads(manufacturer.emails)
            if isinstance(parsed, list):
                emails = parsed
        except Exception:
            emails = [{"label": "Work", "email": manufacturer.emails}]

    # Speciality parsing
    spec_val = None
    if manufacturer.speciality:
        try:
            spec_val = ManufacturerSpeciality(manufacturer.speciality)
        except ValueError:
            spec_val = None

    return {
        "id": manufacturer.id,
        "created_by_user_id": manufacturer.created_by_user_id,
        "name": manufacturer.name,
        "speciality": spec_val,
        "emails": emails,
        "phone_number": manufacturer.phone_number,
        "location": manufacturer.location,
        "status": "Active" if manufacturer.is_active else "Inactive",
        "public_token": manufacturer.public_token,
        "created_at": manufacturer.created_at,
        "updated_at": manufacturer.updated_at,
        "stats": stats,
        "sent_requests": sent_requests,
        "production_timeline": production_timeline,
    }
