from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from app.models.user import User
from app.models.user_device import UserDevice
from app.models.refresh_token import RefreshToken
from app.models.notification_setting import NotificationSetting
from app.models.brand_setting import BrandSetting
from app.core.security import get_password_hash, verify_password, hash_token, verify_token
from app.core.config import settings


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_user(self, email: str, username: str, full_name: str, password: str, 
                    is_verified: bool = False, business_name: str = None, whatsapp_number: str = None) -> User:
        """Create a new user"""
        hashed_password = get_password_hash(password)
        db_user = User(
            email=email,
            username=username,
            full_name=full_name,
            hashed_password=hashed_password,
            business_name=business_name,
            is_active=True,
            is_verified=is_verified,
            whatsapp_number=whatsapp_number
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)

        # Automatically create default notification settings (all fields ON)
        db_notif = NotificationSetting(
            user_id=db_user.id,
            email_notifications=True,
            push_notifications=True,
            design_approval_alerts=True,
            manufacturer_updates=True,
            quote_reminders=True  # All fields ON by default on registration
        )
        self.db.add(db_notif)
        self.db.commit()

        # Automatically create default brand settings
        db_brand = BrandSetting(
            user_id=db_user.id,
            brand_name=db_user.business_name or "Craftsman AI",
            logo_url=None,
            business_email=db_user.email,
            phone_number=None,
            primary_color="#6366F1"
        )
        self.db.add(db_brand)
        self.db.commit()

        return db_user

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_email_or_username(self, identifier: str) -> Optional[User]:
        """Get user by email or username"""
        return self.db.query(User).filter(
            or_(User.email == identifier, User.username == identifier)
        ).first()

    def update_user(self, user_id: int, **kwargs) -> Optional[User]:
        """Update user fields"""
        user = self.get_user_by_id(user_id)
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            self.db.commit()
            self.db.refresh(user)
        return user

    def update_last_login(self, user_id: int) -> bool:
        """Update user's last login timestamp"""
        user = self.get_user_by_id(user_id)
        if user:
            user.last_login = datetime.now(timezone.utc)
            self.db.commit()
            return True
        return False

    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def email_exists(self, email: str) -> bool:
        """Check if email already exists"""
        return self.db.query(User).filter(User.email == email).first() is not None

    def username_exists(self, username: str) -> bool:
        """Check if username already exists"""
        return self.db.query(User).filter(User.username == username).first() is not None

    def whatsapp_number_exists(self, whatsapp_number: str) -> bool:
        """Check if whatsapp number already exists"""
        return self.db.query(User).filter(User.whatsapp_number == whatsapp_number).first() is not None

    def check_existing_identities(self, email: str, whatsapp_number: str) -> dict:
        """
        Single-query check for all uniqueness constraints relevant at signup.
        Returns a dict with booleans: { 'email': bool, 'whatsapp': bool }
        Avoids multiple round-trips by querying once.
        """
        users = self.db.query(User).filter(
            or_(User.email == email, User.whatsapp_number == whatsapp_number)
        ).all()
        result = {"email": False, "whatsapp": False}
        for u in users:
            if u.email == email:
                result["email"] = True
            if u.whatsapp_number == whatsapp_number:
                result["whatsapp"] = True
        return result

    def change_password(self, user_id: int, current_password: str, new_password: str) -> bool:
        """Change user password"""
        user = self.get_user_by_id(user_id)
        if not user:
            return False
        
        if not verify_password(current_password, user.hashed_password):
            return False
        
        user.hashed_password = get_password_hash(new_password)
        self.db.commit()
        return True

    def deactivate_user(self, user_id: int) -> bool:
        """Deactivate user account"""
        user = self.get_user_by_id(user_id)
        if user:
            user.is_active = False
            self.db.commit()
            return True
        return False


class DeviceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_device(self, user_id: int, device_info: dict) -> UserDevice:
        """Create a new device for user"""
        device = UserDevice(
            user_id=user_id,
            device_name=device_info.get("device_name"),
            device_type=device_info.get("device_type"),
            device_id=device_info.get("device_id"),
            user_agent=device_info.get("user_agent"),
            ip_address=device_info.get("ip_address"),
            is_active=True
        )
        self.db.add(device)
        self.db.commit()
        self.db.refresh(device)
        return device

    def get_user_devices(self, user_id: int, active_only: bool = True) -> List[UserDevice]:
        """Get all devices for a user"""
        query = self.db.query(UserDevice).filter(UserDevice.user_id == user_id)
        if active_only:
            query = query.filter(UserDevice.is_active == True)
        return query.all()

    def get_device_by_id(self, device_id: int) -> Optional[UserDevice]:
        """Get device by ID"""
        return self.db.query(UserDevice).filter(UserDevice.id == device_id).first()

    def get_device_by_device_id(self, user_id: int, device_id: str) -> Optional[UserDevice]:
        """Get device by device_id and user_id"""
        return self.db.query(UserDevice).filter(
            and_(UserDevice.user_id == user_id, UserDevice.device_id == device_id)
        ).first()

    def update_device_last_used(self, device_id: int) -> bool:
        """Update device last used timestamp"""
        device = self.get_device_by_id(device_id)
        if device:
            device.last_used = datetime.now(timezone.utc)
            self.db.commit()
            return True
        return False

    def deactivate_device(self, user_id: int, device_id: int) -> bool:
        """Deactivate a device"""
        device = self.db.query(UserDevice).filter(
            and_(UserDevice.id == device_id, UserDevice.user_id == user_id)
        ).first()
        if device:
            device.is_active = False
            self.db.commit()
            return True
        return False

    def get_active_device_count(self, user_id: int) -> int:
        """Get count of active devices for user"""
        return self.db.query(UserDevice).filter(
            and_(UserDevice.user_id == user_id, UserDevice.is_active == True)
        ).count()

    def revoke_old_devices(self, user_id: int, max_devices: int) -> int:
        """Revoke oldest devices if exceeding max limit"""
        devices = self.get_user_devices(user_id, active_only=True)
        if len(devices) <= max_devices:
            return 0
        
        # Sort by last_used and revoke oldest
        devices.sort(key=lambda x: x.last_used)
        devices_to_revoke = devices[:-max_devices]
        
        revoked_count = 0
        for device in devices_to_revoke:
            device.is_active = False
            revoked_count += 1
        
        self.db.commit()
        return revoked_count


class RefreshTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_refresh_token(self, user_id: int, token: str, token_id: str, 
                           expires_at: datetime, device_id: str = None) -> RefreshToken:
        """Create a new refresh token"""
        hashed_token = hash_token(token)
        refresh_token = RefreshToken(
            user_id=user_id,
            token_id=token_id,
            hashed_token=hashed_token,
            device_id=device_id,
            expires_at=expires_at,
            is_active=True
        )
        self.db.add(refresh_token)
        self.db.commit()
        self.db.refresh(refresh_token)
        return refresh_token

    def get_refresh_token_by_id(self, token_id: str) -> Optional[RefreshToken]:
        """Get refresh token by token_id"""
        return self.db.query(RefreshToken).filter(RefreshToken.token_id == token_id).first()

    def verify_refresh_token(self, token: str) -> Optional[RefreshToken]:
        """Verify refresh token"""
        hashed_token = hash_token(token)
        return self.db.query(RefreshToken).filter(
            and_(
                RefreshToken.hashed_token == hashed_token,
                RefreshToken.is_active == True,
                RefreshToken.expires_at > datetime.now(timezone.utc)
            )
        ).first()

    def revoke_refresh_token(self, token_id: str) -> bool:
        """Revoke a refresh token"""
        token = self.get_refresh_token_by_id(token_id)
        if token:
            token.is_active = False
            token.revoked_at = datetime.now(timezone.utc)
            self.db.commit()
            return True
        return False

    def revoke_all_user_tokens(self, user_id: int) -> int:
        """Revoke all refresh tokens for a user"""
        tokens = self.db.query(RefreshToken).filter(
            and_(RefreshToken.user_id == user_id, RefreshToken.is_active == True)
        ).all()
        
        revoked_count = 0
        for token in tokens:
            token.is_active = False
            token.revoked_at = datetime.now(timezone.utc)
            revoked_count += 1
        
        self.db.commit()
        return revoked_count

    def revoke_device_tokens(self, user_id: int, device_id: str) -> int:
        """Revoke all refresh tokens for a specific device"""
        tokens = self.db.query(RefreshToken).filter(
            and_(
                RefreshToken.user_id == user_id,
                RefreshToken.device_id == device_id,
                RefreshToken.is_active == True
            )
        ).all()
        
        revoked_count = 0
        for token in tokens:
            token.is_active = False
            token.revoked_at = datetime.now(timezone.utc)
            revoked_count += 1
        
        self.db.commit()
        return revoked_count

    def cleanup_expired_tokens(self) -> int:
        """Clean up expired refresh tokens"""
        expired_tokens = self.db.query(RefreshToken).filter(
            RefreshToken.expires_at <= datetime.now(timezone.utc)
        ).all()
        
        count = len(expired_tokens)
        for token in expired_tokens:
            self.db.delete(token)
        
        self.db.commit()
        return count
