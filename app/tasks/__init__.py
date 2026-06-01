"""
Central task registry for all background tasks
Import tasks from here to ensure they're registered with Celery
"""

# Email tasks
from .email_tasks import (
    send_signup_otp_email,
    send_password_reset_email, 
    send_welcome_email,
    send_customer_share_email,
    send_manufacturer_share_email
)

# Cleanup tasks
from .cleanup_tasks import (
    cleanup_expired_otps,
    cleanup_expired_tokens
)

# Design generation tasks
from .design_tasks import (
    generate_design_base_image,
)

# Metal variant generation tasks
from .metal_variant_tasks import (
    generate_metal_variant_images,
)

# Angle generation tasks
from .angle_variant_tasks import (
    generate_remaining_variant_angles,
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
    "send_customer_share_email",
    "send_manufacturer_share_email",
    
    # Cleanup tasks
    "cleanup_expired_otps",
    "cleanup_expired_tokens",

    # Design tasks
    "generate_design_base_image",

    # Metal variant tasks
    "generate_metal_variant_images",

    # Angle variant tasks
    "generate_remaining_variant_angles",
    
    # Analytics tasks (future)
    # "track_user_activity",
    # "generate_daily_reports",
]
