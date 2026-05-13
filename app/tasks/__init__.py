"""
Central task registry for all background tasks
Import tasks from here to ensure they're registered with Celery
"""

# Email tasks
from .email_tasks import (
    send_signup_otp_email,
    send_password_reset_email, 
    send_welcome_email
)

# Cleanup tasks
from .cleanup_tasks import (
    cleanup_expired_otps,
    cleanup_expired_tokens
)

# Analytics tasks (future)
# from .analytics_tasks import (
#     track_user_activity,
#     generate_daily_reports
# )

__all__ = [
    # Email tasks
    "send_signup_otp_email",
    "send_password_reset_email", 
    "send_welcome_email",
    
    # Cleanup tasks
    "cleanup_expired_otps",
    "cleanup_expired_tokens",
    
    # Analytics tasks (future)
    # "track_user_activity",
    # "generate_daily_reports",
]
