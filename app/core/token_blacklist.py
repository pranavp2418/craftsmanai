import redis
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class TokenBlacklist:
    """Redis-based token blacklisting service"""
    
    def __init__(self):
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
    
    def blacklist_access_token(self, jti: str, expires_in_minutes: int = 15):
        """
        Blacklist access token by JTI
        
        Args:
            jti: JWT ID of the access token
            expires_in_minutes: Minutes until token expires naturally
        """
        try:
            # Store in Redis with TTL matching token expiration
            ttl = expires_in_minutes * 60
            self.redis_client.setex(
                f"blacklist:access:{jti}", 
                ttl, 
                "revoked"
            )
            logger.info(f"Blacklisted access token JTI: {jti}")
            return True
        except Exception as e:
            logger.error(f"Failed to blacklist access token {jti}: {str(e)}")
            return False
    
    def blacklist_refresh_token(self, jti: str, expires_at: datetime):
        """
        Blacklist refresh token by JTI
        
        Args:
            jti: JWT ID of the refresh token
            expires_at: Expiration datetime of the token
        """
        try:
            # Calculate TTL until token expiration
            now = datetime.now(timezone.utc)
            ttl = int((expires_at - now).total_seconds())
            
            if ttl > 0:
                self.redis_client.setex(
                    f"blacklist:refresh:{jti}", 
                    ttl, 
                    "revoked"
                )
                logger.info(f"Blacklisted refresh token JTI: {jti}")
                return True
            else:
                logger.info(f"Refresh token {jti} already expired, skipping blacklist")
                return True
        except Exception as e:
            logger.error(f"Failed to blacklist refresh token {jti}: {str(e)}")
            return False
    
    def is_access_token_blacklisted(self, jti: str) -> bool:
        """
        Check if access token is blacklisted
        
        Args:
            jti: JWT ID of the access token
            
        Returns:
            True if token is blacklisted
        """
        try:
            result = self.redis_client.get(f"blacklist:access:{jti}")
            return result is not None
        except Exception as e:
            logger.error(f"Failed to check access token blacklist for {jti}: {str(e)}")
            # Fail safe - if redis is down, don't block
            return False
    
    def is_refresh_token_blacklisted(self, jti: str) -> bool:
        """
        Check if refresh token is blacklisted
        
        Args:
            jti: JWT ID of the refresh token
            
        Returns:
            True if token is blacklisted
        """
        try:
            result = self.redis_client.get(f"blacklist:refresh:{jti}")
            return result is not None
        except Exception as e:
            logger.error(f"Failed to check refresh token blacklist for {jti}: {str(e)}")
            # Fail safe - if redis is down, don't block
            return False
    
    def blacklist_user_all_tokens(self, user_id: str):
        """
        Blacklist all tokens for a user (emergency logout)
        
        Args:
            user_id: User ID to blacklist all tokens for
        """
        try:
            # Mark user as having all tokens revoked
            self.redis_client.setex(
                f"blacklist:user:{user_id}", 
                7 * 24 * 60 * 60,  # 7 days
                "all_tokens_revoked"
            )
            logger.info(f"Blacklisted all tokens for user: {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to blacklist all tokens for user {user_id}: {str(e)}")
            return False
    
    def is_user_all_tokens_revoked(self, user_id: str) -> bool:
        """
        Check if all tokens for a user should be revoked
        
        Args:
            user_id: User ID to check
            
        Returns:
            True if all tokens should be revoked for this user
        """
        try:
            result = self.redis_client.get(f"blacklist:user:{user_id}")
            return result is not None
        except Exception as e:
            logger.error(f"Failed to check user blacklist for {user_id}: {str(e)}")
            return False
    
    def cleanup_expired_blacklist_entries(self):
        """
        Cleanup expired blacklist entries (Redis handles this automatically with TTL)
        This is mainly for monitoring/logging purposes
        """
        try:
            # Redis automatically cleans up expired keys with TTL
            # This method can be used for monitoring
            access_blacklist_count = len(self.redis_client.keys("blacklist:access:*"))
            refresh_blacklist_count = len(self.redis_client.keys("blacklist:refresh:*"))
            user_blacklist_count = len(self.redis_client.keys("blacklist:user:*"))
            
            logger.info(f"Blacklist counts - Access: {access_blacklist_count}, "
                       f"Refresh: {refresh_blacklist_count}, User: {user_blacklist_count}")
        except Exception as e:
            logger.error(f"Failed to cleanup blacklist entries: {str(e)}")


# Global blacklist instance
token_blacklist = TokenBlacklist()
