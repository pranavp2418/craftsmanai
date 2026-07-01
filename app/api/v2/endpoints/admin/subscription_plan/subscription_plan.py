from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, cast, String
import uuid

from app.core.dependencies import get_db, get_current_superuser as get_current_admin, get_current_user
from app.models.user import User
from app.models.subscription import SubscriptionPlan, UserSubscription, SubscriptionStatus
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
    
    Feature flags (can_use_logo, can_use_brand_name, has_unlimited_renders)
    should be set explicitly in the request body. If not provided, all flags
    default to False.
    """
    # Prevent duplicate plan names
    existing = db.query(SubscriptionPlan).filter(
        func.lower(SubscriptionPlan.name) == plan_in.name.strip().lower()
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A subscription plan with the name '{plan_in.name.strip()}' already exists."
        )
    
    # Use provided feature_points or auto-generate from flags
    if hasattr(plan_in, 'feature_points') and plan_in.feature_points is not None:
        feature_points = plan_in.feature_points
    else:
        # Auto-generate feature_points array based on feature flags
        generated_features = []
        if plan_in.can_use_logo:
            generated_features.append("Custom Logo")
        if plan_in.can_use_brand_name:
            generated_features.append("Custom Brand Name")
            generated_features.append("Business Email")
            generated_features.append("Custom Phone Number")
        if plan_in.can_use_custom_color:
            generated_features.append("Custom Color")
        if plan_in.has_unlimited_renders:
            generated_features.append("Unlimited AI Renders")
        feature_points = generated_features if generated_features else None
    
    plan = SubscriptionPlan(
        name=plan_in.name,
        description=plan_in.description,
        price=plan_in.price or plan_in.monthly_price,
        monthly_price=plan_in.monthly_price,
        duration_days=plan_in.duration_days or 30,
        is_active=plan_in.is_active,
        is_most_popular=plan_in.is_most_popular,
        feature_points=feature_points,
        monthly_renders=plan_in.monthly_renders,
        can_use_logo=plan_in.can_use_logo,
        can_use_brand_name=plan_in.can_use_brand_name,
        can_use_custom_color=plan_in.can_use_custom_color,
        has_unlimited_renders=plan_in.has_unlimited_renders
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


@router.get("/topup-packs")
def get_topup_packs(
    only_active: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Retrieve all topup packs (Admin only).
    """
    from app.models.subscription import TopupPack

    query = db.query(TopupPack)
    if only_active:
        query = query.filter(TopupPack.is_active == True)
    
    packs = query.order_by(TopupPack.price.asc()).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": str(pack.id),
                "renders": pack.renders,
                "price": float(pack.price),
                "is_active": pack.is_active,
                "created_at": pack.created_at.isoformat() if pack.created_at else None,
                "updated_at": pack.updated_at.isoformat() if pack.updated_at else None
            }
            for pack in packs
        ]
    }


@router.put("/topup-packs")
def update_topup_pack(
    pack_id: uuid.UUID = Query(..., alias="id"),
    renders: Optional[int] = Query(None),
    price: Optional[float] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Update a topup pack's renders, price, or is_active flag using its ID in query parameters (Admin only).
    """
    # Import TopupPack from subscription model
    from app.models.subscription import TopupPack

    pack = db.query(TopupPack).filter(TopupPack.id == pack_id).first()
    if not pack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topup pack not found"
        )

    if renders is not None:
        pack.renders = renders
    if price is not None:
        pack.price = price
    if is_active is not None:
        pack.is_active = is_active

    try:
        db.commit()
        db.refresh(pack)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update topup pack: {str(e)}"
        )

    return {
        "success": True,
        "message": "Topup pack updated successfully",
        "data": {
            "id": str(pack.id),
            "renders": pack.renders,
            "price": float(pack.price),
            "is_active": pack.is_active
        }
    }


@router.get("/active-topups", status_code=status.HTTP_200_OK)
def get_active_topup_users(
    *,
    db: Session = Depends(get_db),
    plan_name: str = Query("all", description="Filter by plan name (Starter, Business, Pro)"),
    search: Optional[str] = Query(None, description="Search by retailer name or email"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Get all users with active top-up plans (Admin only).
    """
    from sqlalchemy import or_, text
    from datetime import datetime, timezone
    from app.models.subscription import UserSubscription, SubscriptionPlan, TopupPack, Payment, PaymentStatus
    from app.models.user import User

    now = datetime.now(timezone.utc)

    from sqlalchemy.orm import aliased
    CurrentSub = aliased(UserSubscription, name="current_sub")

    # Subquery to find the latest active/cancelled-but-not-expired subscription ID for a user
    latest_sub_id_subquery = (
        db.query(UserSubscription.id)
        .filter(
            UserSubscription.user_id == User.id,
            UserSubscription.is_queued == False,
            or_(
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
            )
        )
        .order_by(UserSubscription.created_at.desc())
        .limit(1)
        .correlate(User)
        .scalar_subquery()
    )

    # Base query: subscriptions with non-empty active_topups JSON
    query = (
        db.query(UserSubscription)
        .join(User, User.id == UserSubscription.user_id)
        .outerjoin(CurrentSub, CurrentSub.id == latest_sub_id_subquery)
        .filter(
            UserSubscription.is_queued == False,
            or_(
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
            ),
            text("user_subscriptions.active_topups IS NOT NULL AND user_subscriptions.active_topups != '[]'::jsonb")
        )
    )

    # Filter by user's current latest subscription plan name
    if plan_name and plan_name.lower() != "all":
        query = query.join(SubscriptionPlan, SubscriptionPlan.id == CurrentSub.plan_id).filter(
            SubscriptionPlan.name.ilike(f"%{plan_name}%")
        )

    # Search by retailer name or email
    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )

    # Order by subscription end date (renewal date) desc
    query = query.order_by(desc(UserSubscription.end_date))

    # Pagination
    total = query.count()
    offset = (page - 1) * limit
    subscriptions = query.offset(offset).limit(limit).all()

    # Fetch all top-up packs in database to map details
    topup_packs = db.query(TopupPack).all()
    packs_map = {str(p.id): p for p in topup_packs}

    formatted_users = []
    for sub in subscriptions:
        user = sub.user
        
        # Get the actual latest active/cancelled subscription of this user to show the true current plan name
        latest_sub = db.query(UserSubscription).filter(
            UserSubscription.user_id == user.id,
            UserSubscription.is_queued == False,
            or_(
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
            )
        ).order_by(desc(UserSubscription.created_at)).first()
        
        current_plan_name = latest_sub.plan.name if (latest_sub and latest_sub.plan) else (sub.plan.name if sub.plan else "Unknown Plan")
        
        purchased_packs_details = []
        monthly_renewal_price = 0.0
        # Determine overall stripe status of top-ups (default to paid)
        stripe_status = "paid"
        
        active_topups_list = sub.active_topups or []
        for item in active_topups_list:
            t_id = item.get("topup_pack_id")
            renders = item.get("renders", 0)
            pack = packs_map.get(str(t_id))
            
            if pack:
                # pack_name = pack.name or f"Topup Pack - {renders} Renders"
                price = float(pack.price) if pack.price else 0.0
                monthly_renewal_price += price
                
                # Fetch latest payment for this user & top-up pack to check Stripe payment status
                latest_payment = db.query(Payment).filter(
                    Payment.user_id == sub.user_id,
                    Payment.topup_pack_id == pack.id
                ).order_by(desc(Payment.created_at)).first()
                
                pack_status = latest_payment.status.value.lower() if latest_payment else "paid"
                # If any of the topup payments is failed/pending, escalate the status
                if pack_status in ["failed", "pending"]:
                    stripe_status = pack_status
                
                purchased_packs_details.append({
                    "id": str(pack.id),
                    # "name": pack_name,
                    "renders": renders,
                    "price": price,
                    "status": "active" if pack_status == "paid" else "past_due"
                })
            else:
                purchased_packs_details.append({
                    "id": str(t_id),
                    "name": f"Topup Pack - {renders} Renders",
                    "renders": renders,
                    "price": 0.0,
                    "status": "unknown"
                })

        # Overall topup status is past_due if stripe_status is failed or main subscription is past_due
        overall_status = "active"
        if stripe_status == "failed" or sub.status == "past_due" or sub.status == "PAST_DUE":
            overall_status = "past_due"

        formatted_users.append({
            "retailer_id": user.id,
            "retailer_name": user.full_name or user.email,
            "current_plan_name": current_plan_name,
            "purchased_packs": purchased_packs_details,
            "topup_renders": sub.renders_added,
            "monthly_renewal_price": monthly_renewal_price,
            "stripe_status": stripe_status,
            "status": overall_status,
            "renewal_date": sub.end_date.isoformat() if sub.end_date else None
        })

    return {
        "success": True,
        "data": formatted_users,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/active-topups/{retailer_id}", status_code=status.HTTP_200_OK)
def get_retailer_topup_details(
    retailer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Get detailed top-up and render usage information for a specific retailer by ID (Admin only).
    """
    from datetime import datetime, timezone
    from app.models.subscription import UserSubscription, SubscriptionPlan, TopupPack
    from app.models.user import User
    from sqlalchemy import or_

    user = db.query(User).filter(User.id == retailer_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    # Get active or cancelled-but-not-expired subscription
    sub = db.query(UserSubscription).filter(
        UserSubscription.user_id == retailer_id,
        UserSubscription.is_queued == False,
        or_(
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
        )
    ).order_by(UserSubscription.end_date.desc()).first()

    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found for this user")

    plan = sub.plan
    base_plan_price = float(plan.price) if (plan and plan.price) else 0.0
    if plan and plan.monthly_price:
        base_plan_price = float(plan.monthly_price)

    # Render Allocation calculations
    topup_renders = sub.renders_added or 0
    total_renders = sub.initial_monthly_renders or 0
    base_plan_renders = total_renders - topup_renders
    if base_plan_renders < 0:
        base_plan_renders = 0

    # Current Usage
    used_renders = sub.used_monthly_renders or 0
    remaining_renders = total_renders - used_renders
    if remaining_renders < 0:
        remaining_renders = 0

    # Retrieve all top-up packs
    topup_packs = db.query(TopupPack).all()
    packs_map = {str(p.id): p for p in topup_packs}

    active_topup_details = []
    topup_renewal_total = 0.0

    active_topups_list = sub.active_topups or []
    for item in active_topups_list:
        t_id = item.get("topup_pack_id")
        renders = item.get("renders", 0)
        pack = packs_map.get(str(t_id))
        
        if pack:
            pack_name = pack.name or f"Topup Pack - {renders} Renders"
            price = float(pack.price) if pack.price else 0.0
            topup_renewal_total += price
            active_topup_details.append({
                "name": pack_name,
                "status": "active" if item.get("status") == "active" else item.get("status", "active"),
                "price": f"${price:.2f}/mo"
            })
        else:
            active_topup_details.append({
                "name": f"Topup Pack - {renders} Renders",
                "status": "active",
                "price": "$0.00/mo"
            })

    monthly_renewal_total = base_plan_price + topup_renewal_total

    return {
        "success": True,
        "data": {
            "retailer_id": user.id,
            "retailer_name": user.full_name or user.email,
            "render_allocation": {
                "base_plan": base_plan_renders,
                "top_up": topup_renders,
                "total": total_renders
            },
            "current_usage": {
                "renders_used": used_renders,
                "total_renders": total_renders,
                "remaining_renders": remaining_renders,
                "renewal_status": sub.status.value if hasattr(sub.status, 'value') else str(sub.status)
            },
            "active_topup_packs": active_topup_details,
            "monthly_renewal_total": f"${monthly_renewal_total:.2f}/mo"
        }
    }


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


@router.get("/user-subscriptions/")
def read_all_user_subscriptions(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[List[str]] = Query(None),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Retrieve all user subscriptions (Admin only).
    
    Filters:
    - status: Filter by subscription status (ACTIVE, CANCELLED, EXPIRED, TRIAL, PAUSED, PAST_DUE)
    - search: Search by retailer name, email, or business name
    """
    try:
        # Build base query for subscriptions
        query = (
            db.query(
                UserSubscription,
                User.full_name,
                User.email,
                User.business_name,
                SubscriptionPlan.name.label("plan_name")
            )
            .outerjoin(User, UserSubscription.user_id == User.id)
            .outerjoin(SubscriptionPlan, UserSubscription.plan_id == SubscriptionPlan.id)
        )
        
        # Apply status filter - convert string to enum if provided
        status_list = []
        if status:
            try:
                for s in status:
                    if s:
                        for part in s.split(','):
                            part_stripped = part.strip()
                            if part_stripped:
                                # Validate against python enum to raise 400 for completely invalid strings
                                valid_enum = SubscriptionStatus(part_stripped.upper())
                                status_list.append(valid_enum.value)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status value in: {status}. Valid values are: ACTIVE, CANCELLED, EXPIRED, TRIAL, PAUSED, PAST_DUE"
                )
        
        if status_list:
            query = query.filter(cast(UserSubscription.status, String).in_(status_list))
        
        # Apply search filter (search in retailer name, email, or business name)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    User.full_name.ilike(search_term),
                    User.email.ilike(search_term),
                    User.business_name.ilike(search_term)
                )
            )
        
        # Get total count with filters applied - use the same base query but just count
        # Build a fresh query for counting that includes necessary joins
        count_base = db.query(func.count(UserSubscription.id)).select_from(UserSubscription)
        
        # Join with User and SubscriptionPlan for search filter
        if search:
            count_base = count_base.outerjoin(User, UserSubscription.user_id == User.id)
            count_base = count_base.outerjoin(SubscriptionPlan, UserSubscription.plan_id == SubscriptionPlan.id)
        
        # Apply same filters to count query
        if status_list:
            count_base = count_base.filter(cast(UserSubscription.status, String).in_(status_list))
        if search:
            count_base = count_base.filter(
                or_(
                    User.full_name.ilike(search_term),
                    User.email.ilike(search_term),
                    User.business_name.ilike(search_term)
                )
            )
        
        total_count = count_base.scalar() or 0
        
        if total_count == 0:
            return {"success": True, "data": [], "total": 0}

        rows = (
            query
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
            business_name = row[3]
            plan_name = row[4]
            
            # Calculate usage metrics
            renders_used = sub.used_monthly_renders or 0
            renders_total = sub.initial_monthly_renders or 0
            renders_remaining = max(0, renders_total - renders_used)
            topup_renders = sub.renders_added or 0

            data.append({
                "id": str(sub.id),
                "user_id": sub.user_id,
                "user_name": user_name or user_email or "Unknown",
                "email": user_email or "Unknown",
                "business_name": business_name,
                "plan_id": str(sub.plan_id) if sub.plan_id else None,
                "plan_name": plan_name or "Unknown Plan",
                "status": sub.status.value if hasattr(sub.status, 'value') else sub.status,
                "start_date": sub.start_date.isoformat() if sub.start_date else None,
                "end_date": sub.end_date.isoformat() if sub.end_date else None,
                "created_at": sub.created_at.isoformat() if sub.created_at else None,
                "usage": {
                    "renders_used": renders_used,
                    "renders_total": renders_total,
                    "renders_remaining": renders_remaining,
                    "topup_renders": topup_renders
                }
            })

        return {
            "success": True,
            "data": data,
            "total": total_count
        }
    
    except HTTPException:
        raise
    except Exception as e:
        # Log the error for debugging
        import logging
        logging.error(f"Error fetching user subscriptions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching subscriptions: {str(e)}"
        )








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

    # If feature_points is explicitly provided, use it as-is
    # Otherwise, if any feature flag is being updated, auto-regenerate feature_points
    if "feature_points" not in update_data:
        feature_flags = ["can_use_logo", "can_use_brand_name", "can_use_custom_color", "has_unlimited_renders"]
        if any(flag in update_data for flag in feature_flags):
            # Get final values (updated or existing)
            final_can_use_logo = update_data.get("can_use_logo", plan.can_use_logo)
            final_can_use_brand_name = update_data.get("can_use_brand_name", plan.can_use_brand_name)
            final_can_use_custom_color = update_data.get("can_use_custom_color", plan.can_use_custom_color)
            final_has_unlimited_renders = update_data.get("has_unlimited_renders", plan.has_unlimited_renders)
            
            generated_features = []
            if final_can_use_logo:
                generated_features.append("Custom Logo")
            if final_can_use_brand_name:
                generated_features.append("Custom Brand Name")
                generated_features.append("Business Email")
                generated_features.append("Custom Phone Number")
            if final_can_use_custom_color:
                generated_features.append("Custom Color")
            if final_has_unlimited_renders:
                generated_features.append("Unlimited AI Renders")
            update_data["feature_points"] = generated_features if generated_features else None

    for field, value in update_data.items():
        setattr(plan, field, value)

    try:
        db.commit()
        db.refresh(plan)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return plan




