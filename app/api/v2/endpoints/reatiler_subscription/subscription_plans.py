from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.subscription import SubscriptionPlan
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
    query = select(SubscriptionPlan).where(SubscriptionPlan.is_active == True).offset(skip).limit(limit)
    plans = db.execute(query).scalars().all()
    return plans
