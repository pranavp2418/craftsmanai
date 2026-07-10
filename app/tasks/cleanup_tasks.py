"""
Database cleanup and maintenance tasks using Celery
All periodic cleanup operations are handled here
"""

from app.tasks.base import create_task
from celery.schedules import crontab
import logging

logger = logging.getLogger(__name__)


@create_task(name="cleanup_expired_otps", bind=False)
def cleanup_expired_otps():
    """
    Clean up expired OTPs from database
    
    Schedule: Every hour at minute 0
    Purpose: Remove OTP records that have expired
    """
    task_name = "cleanup_expired_otps"
    
    try:
        logger.info(f"🧹 Starting {task_name}")
        
        from app.core.database import SessionLocal
        from app.models.otp import OTP
        from app.core.timezone import now as tz_now
        
        db = SessionLocal()
        try:
            # Count expired OTPs before deletion
            expired_count = db.query(OTP).filter(
                OTP.expires_at <= tz_now()
            ).count()
            
            # Delete expired OTPs
            deleted_count = db.query(OTP).filter(
                OTP.expires_at <= tz_now()
            ).delete()
            
            db.commit()
            
            logger.info(f"✅ {task_name}: Deleted {deleted_count} expired OTPs")
            return True
            
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"❌ {task_name} failed: {str(exc)}")


@create_task(name="cleanup_expired_tokens", bind=False)
def cleanup_expired_tokens():
    """
    Clean up expired refresh tokens from database
    
    Schedule: Every 6 hours
    Purpose: Remove token records that have expired
    """
    task_name = "cleanup_expired_tokens"
    
    try:
        logger.info(f"🧹 Starting {task_name}")
        
        from app.core.database import SessionLocal
        from app.repositories.user import RefreshTokenRepository
        
        db = SessionLocal()
        try:
            token_repo = RefreshTokenRepository(db)
            expired_count = token_repo.cleanup_expired_tokens()
            
            logger.info(f"✅ {task_name}: Cleaned up {expired_count} expired tokens")
            return True
            
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"❌ {task_name} failed: {str(exc)}")


@create_task(name="cleanup_blacklisted_tokens", bind=False)
def cleanup_blacklisted_tokens():
    """
    Clean up expired blacklisted tokens from Redis and Database
    
    Schedule: Daily at 2 AM
    Purpose: Maintenance for Redis and Database blacklist storage
    """
    task_name = "cleanup_blacklisted_tokens"
    
    try:
        logger.info(f"🧹 Starting {task_name}")
        
        # 1. Redis monitoring
        from app.core.token_blacklist import token_blacklist
        token_blacklist.cleanup_expired_blacklist_entries()
        
        # 2. Database cleanup
        from app.core.database import SessionLocal
        from app.models.blacklisted_token import BlacklistedToken
        from app.core.timezone import now as tz_now
        
        db = SessionLocal()
        try:
            deleted_count = db.query(BlacklistedToken).filter(
                BlacklistedToken.expires_at <= tz_now()
            ).delete()
            db.commit()
            logger.info(f"✅ {task_name}: Deleted {deleted_count} expired blacklisted tokens from DB")
        finally:
            db.close()
            
        logger.info(f"✅ {task_name}: Blacklist cleanup completed")
        return True
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed: {str(exc)}")


# Schedule periodic tasks using Celery Beat
# These will be automatically registered when Celery starts

# NOTE: Periodic task registration disabled to prevent import-time issues
# Uncomment when properly configured with Celery Beat
# from app.tasks.config import SCHEDULE_CONFIG
# 
# def register_periodic_tasks():
#     """Register all periodic tasks from config"""
#     from app.core.celery_app import celery_app
#     
#     for task_name, task_config in SCHEDULE_CONFIG.items():
#         # Import the task function dynamically
#         module_path, function_name = task_config['task'].rsplit('.', 1)
#         module = __import__(module_path, fromlist=[function_name.split('.')[-1]])
#         task_func = getattr(module, function_name)
#         
#         # Register the periodic task
#         celery_app.add_periodic_task(
#             schedule=task_config['schedule'],
#             task=task_func,
#             name=f"periodic_{task_name}",
#             **task_config.get('options', {})
#         )
