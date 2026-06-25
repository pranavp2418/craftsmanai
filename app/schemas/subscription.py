from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, UUID4, ConfigDict
from decimal import Decimal

# SubscriptionPlan Schemas
class SubscriptionPlanBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[Decimal] = None
    monthly_price: Optional[Decimal] = None
    duration_days: Optional[int] = None
    is_active: bool = True
    is_most_popular: bool = False
    feature_points: Optional[List[str]] = None
    monthly_renders: int = -1

class SubscriptionPlanCreate(SubscriptionPlanBase):
    pass

class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    monthly_price: Optional[Decimal] = None
    duration_days: Optional[int] = None
    is_active: Optional[bool] = None
    is_most_popular: Optional[bool] = None
    feature_points: Optional[List[str]] = None
    monthly_renders: Optional[int] = None

class SubscriptionPlanInDBBase(SubscriptionPlanBase):
    id: UUID4
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SubscriptionPlan(SubscriptionPlanInDBBase):
    pass

# UserSubscription Schemas
class UserSubscriptionBase(BaseModel):
    user_id: int
    plan_id: UUID4
    start_date: datetime
    end_date: datetime
    status: str
    cancellation_reason: Optional[str] = None

class UserSubscriptionCreate(UserSubscriptionBase):
    pass

class UserSubscriptionUpdate(BaseModel):
    status: Optional[str] = None
    cancellation_reason: Optional[str] = None

class UserSubscriptionInDBBase(UserSubscriptionBase):
    id: UUID4
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class UserSubscription(UserSubscriptionInDBBase):
    plan_name: Optional[str] = None
    plan: Optional[SubscriptionPlan] = None

# Payment Schemas
class PaymentBase(BaseModel):
    invoice_id: str
    user_id: Optional[int] = None
    plan_id: Optional[UUID4] = None
    amount: Decimal
    currency: str = "USD"
    status: str
    payment_method: Optional[str] = None
    created_at: datetime

class PaymentResponse(PaymentBase):
    id: UUID4
    retailer_name: Optional[str] = None
    plan_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# Cancellation Insights Schemas
class CancellationSummaryKeyInsight(BaseModel):
    primary: str
    secondary: str

class CancellationSummary(BaseModel):
    totalCancellations: int
    churnRate: float
    avgTenure: float
    keyInsight: CancellationSummaryKeyInsight

class CancellationReasonBreakdown(BaseModel):
    reason: str
    count: int
    percentage: float

class CancellationTrend(BaseModel):
    month: str
    count: int
    year: int

class CancellationSummaryResponse(BaseModel):
    success: bool = True
    data: CancellationSummary

class CancellationReasonsResponse(BaseModel):
    success: bool = True
    data: List[CancellationReasonBreakdown]
    total: int = 0
    page: int = 1
    limit: int = 10
    total_pages: int = 1
    has_next: bool = False
    has_prev: bool = False

class CancellationTrendsResponse(BaseModel):
    success: bool = True
    data: List[CancellationTrend]

class SubscriptionActivityLogItem(BaseModel):
    id: UUID4
    event_type: str
    retailer_name: str
    retailer_id_str: Optional[str] = None # e.g., "RET-1234"
    plan_name: Optional[str] = None
    old_plan_name: Optional[str] = None
    triggered_by: str
    triggered_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SubscriptionActivityLogsResponse(BaseModel):
    success: bool = True
    data: List[SubscriptionActivityLogItem]
    total: int
    page: int
    total_pages: int
