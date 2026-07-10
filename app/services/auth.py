from sqlalchemy.orm import Session
from fastapi import HTTPException, status, Request
from typing import Optional, Dict, Any
from datetime import timedelta
from app.core.timezone import now as tz_now
import uuid
import logging

from app.repositories.user import UserRepository, DeviceRepository, RefreshTokenRepository
from app.schemas.auth import (
    UserCreate, UserResponse, LoginRequest, LoginResponse, 
    RefreshTokenResponse, DeviceInfo, PasswordChangeRequest
)
from app.core.security import (
    create_access_token, create_refresh_token, decode_access_token, 
    decode_refresh_token, create_reset_token, decode_reset_token,
    get_password_hash, generate_otp
)
from app.core.config import settings
from app.models.user import User
from app.models.otp import OTP
from app.models.user_device import UserDevice
from app.models.refresh_token import RefreshToken

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.device_repo = DeviceRepository(db)
        self.token_repo = RefreshTokenRepository(db)

    def register_user(self, user_data: UserCreate, device_info: Optional[DeviceInfo] = None) -> UserResponse:
        """Register a new user"""
        # Check if email or username already exists
        if self.user_repo.email_exists(user_data.email):
            logger.warning(f"Registration attempt with existing email: {user_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        if self.user_repo.username_exists(user_data.username):
            logger.warning(f"Registration attempt with existing username: {user_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        # Create user
        user = self.user_repo.create_user(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            password=user_data.password
        )
        
        # Create device if provided
        if device_info:
            device_data = device_info.dict(exclude_none=True)
            if not device_data.get("device_id"):
                device_data["device_id"] = str(uuid.uuid4())
            self.device_repo.create_device(user.id, device_data)
        
        logger.info(f"User registered successfully: {user.email}")
        return UserResponse.from_orm(user)

    def authenticate_user(self, login_data: LoginRequest, device_info: Optional[DeviceInfo] = None) -> LoginResponse:
        """Authenticate user and return tokens"""
        # Authenticate user
        user = self.user_repo.authenticate_user(login_data.email, login_data.password)
        if not user:
            logger.warning(f"Login failed for email: {login_data.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        if not user.is_active:
            logger.warning(f"Login attempt for inactive user: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
            )
        
        # Handle device management
        device_id = None
        if device_info:
            device_data = device_info.dict(exclude_none=True)
            if not device_data.get("device_id"):
                device_data["device_id"] = str(uuid.uuid4())
            
            # Check if device already exists
            existing_device = self.device_repo.get_device_by_device_id(
                user.id, device_data["device_id"]
            )
            
            if existing_device:
                device_id = device_data["device_id"]
                self.device_repo.update_device_last_used(existing_device.id)
            else:
                # Check if user exceeds max devices
                active_devices = self.device_repo.get_active_device_count(user.id)
                if active_devices >= settings.MAX_ACTIVE_DEVICES:
                    # Revoke oldest device
                    revoked = self.device_repo.revoke_old_devices(user.id, settings.MAX_ACTIVE_DEVICES - 1)
                    logger.info(f"Revoked {revoked} old devices for user: {user.email}")
                
                new_device = self.device_repo.create_device(user.id, device_data)
                device_id = device_data["device_id"]
        
        # Create tokens
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        refresh_token, token_id, expires_at = create_refresh_token(
            str(user.id), login_data.remember_me
        )
        
        # Store refresh token
        self.token_repo.create_refresh_token(
            user_id=user.id,
            token=refresh_token,
            token_id=token_id,
            expires_at=expires_at,
            device_id=device_id
        )
        
        # Update last login
        self.user_repo.update_last_login(user.id)
        
        logger.info(f"User authenticated successfully: {user.email}")
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.from_orm(user)
        )

    def refresh_access_token(self, refresh_token: str, device_info: Optional[DeviceInfo] = None) -> RefreshTokenResponse:
        """Refresh access token using refresh token"""
        # Verify refresh token
        token_record = self.token_repo.verify_refresh_token(refresh_token)
        if not token_record:
            logger.warning("Invalid refresh token provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Get user
        user = self.user_repo.get_user_by_id(token_record.user_id)
        if not user or not user.is_active:
            logger.warning(f"Refresh token for inactive/invalid user: {token_record.user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Update device last used
        if token_record.device_id:
            device = self.device_repo.get_device_by_device_id(user.id, token_record.device_id)
            if device:
                self.device_repo.update_device_last_used(device.id)
        
        # Create new access token
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        
        logger.info(f"Access token refreshed for user: {user.email}")
        
        return RefreshTokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    def logout_user(self, refresh_token: str) -> bool:
        """Logout user by revoking refresh token"""
        # Decode token to get token_id
        try:
            payload = decode_refresh_token(refresh_token)
            if not payload:
                logger.warning("Invalid refresh token during logout")
                return False
            
            token_id = payload.get("jti")
            if not token_id:
                logger.warning("No token_id found in refresh token during logout")
                return False
            
            # Revoke token
            revoked = self.token_repo.revoke_refresh_token(token_id)
            if revoked:
                logger.info(f"User logged out successfully, token revoked: {token_id}")
            
            return revoked
            
        except Exception as e:
            logger.error(f"Error during logout: {str(e)}")
            return False

    def logout_all_devices(self, user_id: int) -> int:
        """Logout user from all devices"""
        revoked_count = self.token_repo.revoke_all_user_tokens(user_id)
        logger.info(f"User logged out from all devices, tokens revoked: {revoked_count}")
        return revoked_count

    def change_password(self, user_id: int, password_data: PasswordChangeRequest) -> bool:
        """Change user password"""
        success = self.user_repo.change_password(
            user_id, password_data.current_password, password_data.new_password
        )
        
        if success:
            # Revoke all refresh tokens for security
            revoked_count = self.token_repo.revoke_all_user_tokens(user_id)
            logger.info(f"Password changed for user {user_id}, revoked {revoked_count} tokens")
        else:
            logger.warning(f"Password change failed for user {user_id}")
        
        return success

    def get_user_devices(self, user_id: int) -> list:
        """Get all active devices for user"""
        devices = self.device_repo.get_user_devices(user_id, active_only=True)
        return [UserDevice.from_orm(device) for device in devices]

    def revoke_device(self, user_id: int, device_id: int) -> bool:
        """Revoke a specific device"""
        # Get device info
        device = self.device_repo.get_device_by_id(device_id)
        if not device or device.user_id != user_id:
            logger.warning(f"Device revocation failed - device not found or unauthorized: {device_id}")
            return False
        
        # Revoke device
        device_revoked = self.device_repo.deactivate_device(user_id, device_id)
        
        # Revoke all tokens for this device
        if device_revoked and device.device_id:
            tokens_revoked = self.token_repo.revoke_device_tokens(user_id, device.device_id)
            logger.info(f"Device {device_id} revoked, {tokens_revoked} tokens revoked")
        
        return device_revoked

    def request_password_reset(self, email: str) -> str:
        """Request password reset"""
        user = self.user_repo.get_user_by_email(email)
        if not user:
            logger.warning(f"Password reset requested for non-existent email: {email}")
            # Don't reveal if email exists or not
            return ""
        
        # Create reset token
        reset_token = create_reset_token(email)
        
        logger.info(f"Password reset token generated for user: {email}")
        # In a real implementation, send email here
        
        return reset_token

    def confirm_password_reset(self, token: str, new_password: str) -> bool:
        """Confirm password reset"""
        # Decode reset token
        payload = decode_reset_token(token)
        if not payload:
            logger.warning("Invalid password reset token")
            return False
        
        email = payload.get("sub")
        if not email:
            logger.warning("No email in password reset token")
            return False
        
        # Get user
        user = self.user_repo.get_user_by_email(email)
        if not user:
            logger.warning(f"Password reset for non-existent user: {email}")
            return False
        
        # Update password
        user.hashed_password = get_password_hash(new_password)
        self.db.commit()
        
        # Revoke all tokens for security
        revoked_count = self.token_repo.revoke_all_user_tokens(user.id)
        
        logger.info(f"Password reset completed for user: {email}, revoked {revoked_count} tokens")
        return True

    def generate_and_save_otp(self, email: str, otp_type: str = "email_verification", user_id: int = None) -> str:
        """Generate and save OTP for user"""
        # Clean up old OTPs for this email and type
        self.db.query(OTP).filter(
            OTP.email == email,
            OTP.otp_type == otp_type,
            OTP.is_used == False
        ).delete()
        
        # Generate new OTP
        otp_code = generate_otp()
        expires_at = tz_now() + timedelta(minutes=10)
        
        # Save OTP
        otp = OTP(
            user_id=user_id,
            email=email,
            otp_code=otp_code,
            otp_type=otp_type,
            expires_at=expires_at
        )
        self.db.add(otp)
        self.db.commit()
        
        return otp_code
    
    def verify_otp_and_login(self, email: str, otp_code: str, device_info: Optional[DeviceInfo] = None) -> dict:
        """Verify OTP and login user"""
        # Find valid OTP
        otp = self.db.query(OTP).filter(
            OTP.email == email,
            OTP.otp_code == otp_code,
            OTP.otp_type == "email_verification",
            OTP.is_used == False,
            OTP.expires_at > tz_now()
        ).first()
        
        if not otp:
            return {
                "success": False,
                "message": "Invalid or expired OTP"
            }
        
        # Get or create user
        user = self.user_repo.get_user_by_email(email)
        if not user:
            return {
                "success": False,
                "message": "User not found"
            }
        
        # Mark OTP as used
        otp.is_used = True
        self.db.commit()
        
        # Mark email as verified
        is_new_verification = not user.is_verified
        if is_new_verification:
            user.is_verified = True
            self.db.commit()
        
        # Create tokens and session
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        refresh_token, token_id, expires_at = create_refresh_token(str(user.id), False)
        
        # Get JTI from tokens for potential blacklisting
        from app.core.security import decode_access_token, decode_refresh_token
        access_payload = decode_access_token(access_token)
        refresh_payload = decode_refresh_token(refresh_token)
        
        # Store refresh token
        self.token_repo.create_refresh_token(
            user_id=user.id,
            token=refresh_token,
            token_id=token_id,
            expires_at=expires_at
        )
        
        # Update last login
        self.user_repo.update_last_login(user.id)
        
        logger.info(f"User verified and logged in: {user.email}")
        
        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
            "user_id": str(user.id),
            "email": user.email,
            "username": user.username,
            "is_superuser": user.is_superuser,
            "is_verified": user.is_verified,
            "is_newly_verified": is_new_verification,
            "notification_message": "Welcome to craftsman.ai! Your account has been verified successfully.",
            "profile_image_url": None
        }

    def get_current_user(self, token: str) -> Optional[User]:
        """Get current user from access token"""
        try:
            payload = decode_access_token(token)
            if not payload:
                return None
            
            user_id = payload.get("sub")
            if not user_id:
                return None
            
            user = self.user_repo.get_user_by_id(int(user_id))
            if not user or not user.is_active:
                return None
            
            return user
            
        except Exception as e:
            logger.error(f"Error getting current user: {str(e)}")
            return None
