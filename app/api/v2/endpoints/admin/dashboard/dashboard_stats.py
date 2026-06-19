from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.api import deps
from app.models.user import User
from app.models.manufacturer import Manufacturer
from app.models.customer import Customer
from app.models.design import Design, DesignStatus

router = APIRouter()

@router.get("/", response_model=Dict[str, Any])
async def get_dashboard_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin)
):
    """
    Get dashboard statistics including:
    - Total retailers (users who are not superusers)
    - Active manufacturers 
    - Total customers
    - Active requests (requests that are not completed)
    - Pending approvals (requests waiting for customer or manufacturer approval)
    """
    
    # Total retailers - count all users except superusers
    total_retailers_result = await db.execute(
        select(func.count(User.id)).where(User.is_superuser == False,
        User.is_verfied == True
        )
    )
    total_retailers = total_retailers_result.scalar() or 0
    
    # Active manufacturers - count manufacturers with is_active True
    active_manufacturers_result = await db.execute(
        select(func.count(Manufacturer.id)).where(Manufacturer.is_active == True)
    )
    active_manufacturers = active_manufacturers_result.scalar() or 0
    
    # Total customers
    total_customers_result = await db.execute(
        select(func.count(Customer.id))
    )
    total_customers = total_customers_result.scalar() or 0
    
    # Active requests - requests that are not completed (excluding deleted/archived)
    active_requests_result = await db.execute(
        select(func.count(Design.id)).where(
            Design.status != DesignStatus.COMPLETED,
            Design.is_deleted == False,
            Design.is_archived == False
        )
    )
    active_requests = active_requests_result.scalar() or 0
    
    # Pending approvals - requests waiting for action (excluding deleted/archived)
    # This includes: SHARED, APPROVED
    pending_approvals_result = await db.execute(
        select(func.count(Design.id)).where(
            Design.status.in_([
                DesignStatus.SHARED,
                DesignStatus.APPROVED
            ]),
            Design.is_deleted == False,
            Design.is_archived == False
        )
    )
    pending_approvals = pending_approvals_result.scalar() or 0
    
    return {
        "totalRetailers": total_retailers,
        "activeManufacturers": active_manufacturers,
        "totalCustomers": total_customers,
        "activeRequests": active_requests,
        "pendingApprovals": pending_approvals
    }
