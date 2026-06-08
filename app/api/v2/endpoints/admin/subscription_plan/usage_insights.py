from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_
from sqlalchemy.orm import aliased

from app.api import deps
from app.models.user import User
from app.models.design import Design, DesignShare, DesignVariant, DesignVariantManufacturerShare

router = APIRouter()


@router.get("/usage-insights", response_model=Dict[str, Any])
async def get_usage_insights(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin)
):
    """
    Get usage insights including:
    - Total AI Renders Generated
    - Total Customer Shares
    - Total Manufacturer Quotes
    - Avg Renders Per Retailer
    """
    
    # Total AI Renders Generated - count all designs
    total_renders_result = await db.execute(
        select(func.count(Design.id)).where(
            and_(Design.is_deleted == False, Design.is_archived == False)
        )
    )
    total_renders = total_renders_result.scalar() or 0
    
    # Total Customer Shares - count all design shares
    total_customer_shares_result = await db.execute(
        select(func.count(DesignShare.id))
    )
    total_customer_shares = total_customer_shares_result.scalar() or 0
    
    # Total Manufacturer Quotes - count all manufacturer shares
    total_manufacturer_quotes_result = await db.execute(
        select(func.count(DesignVariantManufacturerShare.id))
    )
    total_manufacturer_quotes = total_manufacturer_quotes_result.scalar() or 0
    
    # Total Retailers (non-superusers)
    total_retailers_result = await db.execute(
        select(func.count(User.id)).where(User.is_superuser == False)
    )
    total_retailers = total_retailers_result.scalar() or 0
    
    # Avg Renders Per Retailer
    avg_renders_per_retailer = round(total_renders / total_retailers, 1) if total_retailers > 0 else 0.0
    
    return {
        "totalAIRendersGenerated": total_renders,
        "totalCustomerShares": total_customer_shares,
        "totalManufacturerQuotes": total_manufacturer_quotes,
        "avgRendersPerRetailer": avg_renders_per_retailer
    }
