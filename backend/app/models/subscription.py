from sqlalchemy import Column, String, DateTime, Boolean, Numeric, Integer, ForeignKey, Enum, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum
import uuid
from typing import Optional
from datetime import datetime
from app.core.timezone import CST_TZ

class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    TRIAL = "TRIAL"
    PAUSED = "PAUSED"
    PAST_DUE = "PAST_DUE"

class PaymentStatus(str, enum.Enum):
    PAID = "PAID"
    PENDING = "PENDING"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    monthly_price = Column(Numeric(10, 2), nullable=True)
    yearly_price = Column(Numeric(10, 2), nullable=True)
    duration_days = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    is_most_popular = Column(Boolean, default=False)
    feature_points = Column(JSON, nullable=True)
    monthly_renders = Column(Integer, default=-1)
    customer_shares = Column(Integer, default=-1)
    manufacturer_quotes = Column(Integer, default=-1)
    # Feature flags for plan-based access control
    can_use_logo = Column(Boolean, default=False, nullable=False)
    can_use_brand_name = Column(Boolean, default=False, nullable=False)
    can_use_custom_color = Column(Boolean, default=False, nullable=False)
    has_unlimited_renders = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), onupdate=lambda: datetime.now(CST_TZ))

    # Relationships
    subscriptions = relationship("UserSubscription", back_populates="plan", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="plan")


class CancellationReason(str, enum.Enum):
    TOO_EXPENSIVE = "Too Expensive"
    NOT_USING_ENOUGH = "Not Using Enough"
    FOUND_ALTERNATIVE = "Found Alternative"
    STORE_CLOSED = "Store Closed"
    OTHER = "Other"

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    # Note: unique=True allows multiple NULLs (SQL standard behavior). Use partial index in DB if needed.
    stripe_subscription_id = Column(String, nullable=True, unique=True, index=True)
    stripe_customer_id = Column(String, nullable=True, index=True)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False)
    cancellation_reason = Column(Enum(CancellationReason), nullable=True)
    cancellation_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), onupdate=lambda: datetime.now(CST_TZ))
    
    # -------------------------
    # Subscription Queue & Token Tracking
    # -------------------------
    is_queued = Column(Boolean, default=False, nullable=False)
    activates_after_subscription_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    initial_monthly_renders = Column(Integer, default=0, nullable=False)
    used_monthly_renders = Column(Integer, default=0, nullable=False)
    topup_plan_id = Column(UUID(as_uuid=True), ForeignKey("topup_packs.id", ondelete="SET NULL"), nullable=True)
    renders_added = Column(Integer, default=0, nullable=False)
    active_topups = Column(JSON, default=list, nullable=True)

    # Relationships
    user = relationship("User", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
    topups = relationship("UserTopup", back_populates="subscription", cascade="all, delete-orphan")

    @property
    def plan_name(self) -> Optional[str]:
        return self.plan.name if self.plan else None


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    invoice_id = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id", ondelete="SET NULL"), nullable=True, index=True)
    topup_pack_id = Column(UUID(as_uuid=True), ForeignKey("topup_packs.id", ondelete="SET NULL"), nullable=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="USD")
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    stripe_session_id = Column(String, nullable=True)
    stripe_payment_intent_id = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    stripe_webhook_event_id = Column(String, nullable=True, index=True)  # For webhook idempotency
    payment_method = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), onupdate=lambda: datetime.now(CST_TZ))

    # Relationships
    user = relationship("User", back_populates="payments")
    plan = relationship("SubscriptionPlan", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payment", uselist=False, cascade="all, delete-orphan")


class SubscriptionEventType(str, enum.Enum):
    CREATED = "Subscription Created"
    UPGRADED = "Subscription Upgraded"
    CANCELLED = "Subscription Cancelled"
    PAUSED = "Subscription Paused"
    RESUMED = "Subscription Resumed"
    DOWNGRADED = "Subscription Downgraded"


class SubscriptionActivityLog(Base):
    __tablename__ = "subscription_activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(Enum(SubscriptionEventType), nullable=False, index=True)
    plan_name = Column(String, nullable=True)
    old_plan_name = Column(String, nullable=True)
    triggered_by = Column(String, nullable=False)  # e.g., "Admin", "System", "Retailer"
    triggered_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="subscription_logs")


class TopupPack(Base):
    __tablename__ = "topup_packs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    renders = Column(Integer, nullable=False, default=0)
    price = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), onupdate=lambda: datetime.now(CST_TZ))


class UserTopup(Base):
    __tablename__ = "user_topups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_subscription_id = Column(UUID(as_uuid=True), ForeignKey("user_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    topup_pack_id = Column(UUID(as_uuid=True), ForeignKey("topup_packs.id", ondelete="SET NULL"), nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True, unique=False, index=True)
    status = Column(String, default="active", nullable=False, index=True)  # active, cancelled, expired, past_due
    renders = Column(Integer, nullable=False, default=0)
    price = Column(Numeric(10, 2), nullable=False)
    
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(CST_TZ), onupdate=lambda: datetime.now(CST_TZ))

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    subscription = relationship("UserSubscription", back_populates="topups")
    topup_pack = relationship("TopupPack")
