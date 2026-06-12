from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(255))
    whatsapp_number = Column(String(20))
    hashed_password = Column(String(255), nullable=False)
    business_name = Column(String(255), nullable=True, doc="Business name for design code generation (e.g., 'Jack John' -> 'jj')")
    design_prefix = Column(String(10), nullable=True, doc="Prefix used for generating design codes")
    profile_picture_url = Column(String(255), nullable=True)
    # Team member fields
    is_team_member = Column(Boolean, default=False, doc="Indicates if this user is a team member (not the account owner)")
    team_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True, doc="The user who invited/owns this team member")
    
    # Appearance fields
    theme = Column(String(20), default="System Preference", doc="UI Theme: System Preference, Light Mode, Dark Mode")
    navigation_color = Column(String(20), default="Light", doc="Sidebar navigation color: Light, Dark")

    # Status fields
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    is_2fa_enabled = Column(Boolean, default=False)
    subscription_plan = Column(String(50), default="Starter", nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    devices = relationship("UserDevice", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    otps = relationship("OTP", back_populates="user", cascade="all, delete-orphan")
    notification_settings = relationship("NotificationSetting", back_populates="user", uselist=False, cascade="all, delete-orphan")
    brand_setting = relationship("BrandSetting", back_populates="user", uselist=False, cascade="all, delete-orphan")
    subscriptions = relationship("UserSubscription", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    subscription_logs = relationship("SubscriptionActivityLog", foreign_keys="[SubscriptionActivityLog.user_id]", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, username={self.username})>"
