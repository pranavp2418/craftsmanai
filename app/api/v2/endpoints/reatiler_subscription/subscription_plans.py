from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, or_

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.subscription import SubscriptionPlan, UserSubscription, SubscriptionStatus
from app.schemas.subscription import SubscriptionPlan as SubscriptionPlanSchema

router = APIRouter()

@router.get("/", response_model=List[SubscriptionPlanSchema])
def read_subscription_plans(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retrieve all subscription plans.
    """
    active_sub = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user.id,
        UserSubscription.status == SubscriptionStatus.ACTIVE,
        UserSubscription.is_queued == False
    ).first()

    current_price = 0
    if active_sub:
        active_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == active_sub.plan_id).first()
        if active_plan:
            current_price = active_plan.monthly_price if active_plan.monthly_price is not None else (active_plan.price or 0)

    query = select(SubscriptionPlan).where(SubscriptionPlan.is_active == True)
    if current_price > 0:
        query = query.where(
            or_(
                SubscriptionPlan.monthly_price > current_price,
                SubscriptionPlan.price > current_price
            )
        )

    query = query.offset(skip).limit(limit)
    plans = db.execute(query).scalars().all()
    return plans


@router.get("/topup-packs")
def get_retailer_topup_packs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retrieve all active topup packs for retailers.
    """
    from app.models.subscription import TopupPack

    packs = db.query(TopupPack).filter(TopupPack.is_active == True).order_by(TopupPack.price.asc()).all()

    return {
        "success": True,
        "data": [
            {
                "id": str(pack.id),
                "renders": pack.renders,
                "price": float(pack.price)
            }
            for pack in packs
        ]
    }
