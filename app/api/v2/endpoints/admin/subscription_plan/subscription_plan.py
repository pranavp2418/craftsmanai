from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import uuid

from app.core.dependencies import get_db, get_current_superuser as get_current_admin
from app.models.user import User
from app.models.subscription import SubscriptionPlan, UserSubscription
from app.schemas.subscription import SubscriptionPlan as SubscriptionPlanSchema, SubscriptionPlanCreate, SubscriptionPlanUpdate

router = APIRouter()


@router.post("/", response_model=SubscriptionPlanSchema, status_code=status.HTTP_201_CREATED)
def create_subscription_plan(
    *,
    db: Session = Depends(get_db),
    plan_in: SubscriptionPlanCreate,
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Create new subscription plan (Admin only ideally).
    """
    plan = SubscriptionPlan(
        name=plan_in.name,
        description=plan_in.description,
        price=plan_in.price or plan_in.monthly_price,
        monthly_price=plan_in.monthly_price,
        yearly_price=plan_in.yearly_price,
        duration_days=plan_in.duration_days or 30,
        is_active=plan_in.is_active,
        is_most_popular=plan_in.is_most_popular,
        feature_points=plan_in.feature_points,
        monthly_renders=plan_in.monthly_renders,
        customer_shares=plan_in.customer_shares,
        manufacturer_quotes=plan_in.manufacturer_quotes
    )
    db.add(plan)
    try:
        db.commit()
        db.refresh(plan)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return plan


@router.get("/", response_model=List[SubscriptionPlanSchema])
def read_subscription_plans(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Retrieve all subscription plans.
    """
    return db.query(SubscriptionPlan).offset(skip).limit(limit).all()


@router.get("/{plan_id}", response_model=SubscriptionPlanSchema)
def read_subscription_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Get a specific subscription plan by ID.
    """
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")
    return plan


@router.put("/{plan_id}", response_model=SubscriptionPlanSchema)
def update_subscription_plan(
    plan_id: uuid.UUID,
    *,
    db: Session = Depends(get_db),
    plan_in: SubscriptionPlanUpdate,
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Update a subscription plan.
    """
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")

    update_data = plan_in.model_dump(exclude_unset=True)
    
    # Handle backward compatibility for price
    if "monthly_price" in update_data and update_data["monthly_price"] is not None:
        update_data["price"] = update_data["monthly_price"]

    for field, value in update_data.items():
        setattr(plan, field, value)

    try:
        db.commit()
        db.refresh(plan)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return plan


@router.get("/user-subscriptions/")
def read_all_user_subscriptions(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Retrieve all user subscriptions (Admin only).
    """
    total_count = db.query(func.count(UserSubscription.id)).scalar() or 0

    if total_count == 0:
        return {"data": [], "total": 0}

    rows = (
        db.query(
            UserSubscription,
            User.full_name,
            User.email,
            SubscriptionPlan.name.label("plan_name")
        )
        .outerjoin(User, UserSubscription.user_id == User.id)
        .outerjoin(SubscriptionPlan, UserSubscription.plan_id == SubscriptionPlan.id)
        .order_by(desc(UserSubscription.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    data = []
    for row in rows:
        sub = row[0]
        user_name = row[1]
        user_email = row[2]
        plan_name = row[3]
        
        data.append({
            "id": sub.id,
            "user_id": sub.user_id,
            "user_name": user_name or user_email or "Unknown",
            "plan_id": sub.plan_id,
            "plan_name": plan_name or "Unknown Plan",
            "status": sub.status,
            "start_date": sub.start_date,
            "end_date": sub.end_date,
            "created_at": sub.created_at
        })

    return {
        "success": True,
        "data": data,
        "total": total_count
    }
