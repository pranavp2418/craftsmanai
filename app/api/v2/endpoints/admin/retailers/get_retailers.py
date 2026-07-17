from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.api import deps
from app.models.user import User
from app.models.design import Design
from app.models.subscription import SubscriptionPlan, UserSubscription, SubscriptionStatus

router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
async def get_retailers(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),

    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),

    status: Optional[str] = Query(
        "ALL",
        description="Filter by ACTIVE, INACTIVE, or ALL"
    ),

    name: Optional[str] = Query(
        None,
        description="Optional partial name search"
    ),

    search: Optional[str] = Query(
        None,
        description="Global search across retailer fields"
    ),

    subfilter: Optional[str] = Query(
        "recently_added",
        description="recently_added | alphabetical | letter:<A-Z>"
    )
):
    skip = (page - 1) * limit

    # Normalize name
    name = name.strip() if name else None

    # -------------------------
    # Base query
    # -------------------------
    # Subquery to count designs per retailer
    request_count_subquery = (
        select(func.count(Design.id))
        .where(Design.user_id == User.id)
        .scalar_subquery()
    )

    # Amount of the retailer's ACTIVE subscription = its plan's price (most recent active one).
    active_sub_amount_subquery = (
        select(SubscriptionPlan.price)
        .join(UserSubscription, UserSubscription.plan_id == SubscriptionPlan.id)
        .where(
            UserSubscription.user_id == User.id,
            UserSubscription.status == SubscriptionStatus.ACTIVE,
        )
        .order_by(UserSubscription.created_at.desc())
        .limit(1)
        .scalar_subquery()
    )

    query = select(
        User,
        request_count_subquery.label("total_requests"),
        active_sub_amount_subquery.label("subscription_amount"),
    ).where(User.is_superuser == False)

    # -------------------------
    # Status filter
    # -------------------------
    db_status = None
    if status:
        status_upper = status.upper()
        if status_upper == "ACTIVE":
            db_status = True
        elif status_upper in ("DISABLED", "INACTIVE"):
            db_status = False

    if db_status is not None:
        query = query.where(User.is_active == db_status)

    # -------------------------
    # Name filter
    # -------------------------
    if name:
        query = query.where(User.full_name.ilike(f"%{name}%"))

    # -------------------------
    # Global search
    # -------------------------
    if search:
        terms = search.strip().split()

        for term in terms:
            t = f"%{term}%"
            query = query.where(
                or_(
                    User.full_name.ilike(t),
                    User.email.ilike(t),
                    User.whatsapp_number.ilike(t),
                )
            )

    # -------------------------
    # Subfilters (ordering + letter)
    # -------------------------
    if subfilter:
        subfilter = subfilter.lower()

        if subfilter.startswith("letter:"):
            letter = subfilter.split(":", 1)[1].upper()

            if letter.isalpha() and len(letter) == 1:
                query = query.where(User.full_name.ilike(f"{letter}%"))
                query = query.order_by(User.full_name.asc())
            else:
                query = query.order_by(User.created_at.desc())

        elif subfilter == "alphabetical":
            query = query.order_by(User.full_name.asc())

        else:
            query = query.order_by(User.created_at.desc())
    else:
        query = query.order_by(User.created_at.desc())

    # -------------------------
    # Total count
    # -------------------------
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total_retailers = total_result.scalar() or 0

    # -------------------------
    # Pagination
    # -------------------------
    result = await db.execute(query.offset(skip).limit(limit))
    rows = result.all()

    retailer_list = [
        {
            "id": str(retailer.id),
            "full_name": retailer.full_name,
            "email": retailer.email,
            "phone": retailer.whatsapp_number,
            "total_requests": total_requests or 0,
            "status": "ACTIVE" if retailer.is_active else "INACTIVE",
            # Active-subscription amount (null when the retailer has no active paid plan).
            "subscription_amount": float(subscription_amount) if subscription_amount is not None else None,
            "created_at": retailer.created_at,
            "last_active": retailer.updated_at
        }
        for retailer, total_requests, subscription_amount in rows
    ]

    total_pages = (total_retailers + limit - 1) // limit

    # -------------------------
    # Available letters
    # -------------------------
    letter_query = select(
        func.distinct(func.substr(User.full_name, 1, 1))
    ).where(User.is_superuser == False)

    if db_status is not None:
        letter_query = letter_query.where(User.is_active == db_status)

    if name:
        letter_query = letter_query.where(User.full_name.ilike(f"%{name}%"))

    if search:
        terms = search.strip().split()

        for term in terms:
            t = f"%{term}%"
            letter_query = letter_query.where(
                or_(
                    User.full_name.ilike(t),
                    User.email.ilike(t),
                    User.whatsapp_number.ilike(t),
                )
            )

    result_letters = await db.execute(letter_query)

    available_letters: List[str] = sorted([
        row[0].upper()
        for row in result_letters.fetchall()
        if row[0] and row[0].isalpha()
    ])

    return {
        "retailers": retailer_list,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_retailers,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        "available_letters": available_letters
    }