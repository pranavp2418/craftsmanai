from typing import Any, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, and_, desc

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


@router.get("/top-designers", response_model=Dict[str, Any])
async def get_top_designers(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(5, ge=1, le=100, description="Number of records per page"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin)
):
    """
    Get a paginated list of users sorted by design count (image generations) in descending order.
    Each user includes:
    - totalDesignsCreated: Count of designs this user created
    - totalDesignShares: Count of customer shares (DesignShare) for this user's designs
    - totalManufacturerQuotes: Count of manufacturer shares/quotes (DesignVariantManufacturerShare) for this user's designs
    """
    # Step 1: Count total users who have created designs (for pagination)
    total_users_count_result = await db.execute(
        select(func.count(func.distinct(Design.user_id)))
        .where(
            and_(Design.is_deleted == False, Design.is_archived == False)
        )
    )
    total_users = total_users_count_result.scalar() or 0
    total_pages = (total_users + page_size - 1) // page_size if total_users > 0 else 1
    offset = (page - 1) * page_size

    # Step 2: Get users ordered by design count descending with pagination
    user_design_counts = (
        select(
            Design.user_id,
            func.count(Design.id).label("design_count")
        )
        .where(
            and_(Design.is_deleted == False, Design.is_archived == False)
        )
        .group_by(Design.user_id)
        .order_by(desc("design_count"))
        .offset(offset)
        .limit(page_size)
    ).subquery()

    users_result = await db.execute(
        select(User, user_design_counts.c.design_count)
        .join(user_design_counts, User.id == user_design_counts.c.user_id)
        .order_by(desc(user_design_counts.c.design_count))
    )
    rows = users_result.all()

    # Step 3: Build response with share and quote counts for each user
    designers_list = []
    for row in rows:
        user_row = row[0]
        design_count = row[1]

        # Count DesignShares for this user's designs
        shares_count_result = await db.execute(
            select(func.count(DesignShare.id))
            .select_from(Design)
            .join(DesignVariant, DesignVariant.design_id == Design.id)
            .join(DesignShare, DesignShare.design_variant_id == DesignVariant.id)
            .where(
                and_(
                    Design.user_id == user_row.id,
                    Design.is_deleted == False,
                    Design.is_archived == False
                )
            )
        )
        total_design_shares = shares_count_result.scalar() or 0

        # Count DesignVariantManufacturerShares for this user's designs
        manufacturer_shares_count_result = await db.execute(
            select(func.count(DesignVariantManufacturerShare.id))
            .select_from(Design)
            .join(DesignVariant, DesignVariant.design_id == Design.id)
            .join(DesignVariantManufacturerShare, DesignVariantManufacturerShare.design_variant_id == DesignVariant.id)
            .where(
                and_(
                    Design.user_id == user_row.id,
                    Design.is_deleted == False,
                    Design.is_archived == False
                )
            )
        )
        total_manufacturer_shares = manufacturer_shares_count_result.scalar() or 0

        designers_list.append({
            "user": {
                "id": user_row.id,
                "name": user_row.full_name or user_row.username or user_row.email,
                "email": user_row.email
            },
            "totalDesignsCreated": design_count,
            "totalDesignShares": total_design_shares,
            "totalManufacturerQuotes": total_manufacturer_shares
        })

    return {
        "items": designers_list,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_users,
            "totalPages": total_pages
        }
    }