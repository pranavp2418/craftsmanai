"""
Celery configuration and task routing
Central configuration for all background tasks
"""

from celery.schedules import crontab
from app.core.config import settings

# Task queues for different types of work
CELERY_ROUTES = {
    # Email tasks go to email queue
    'app.tasks.email_tasks.send_signup_otp_email': {'queue': 'email'},
    'app.tasks.email_tasks.send_password_reset_email': {'queue': 'email'},
    'app.tasks.email_tasks.send_welcome_email': {'queue': 'email'},
    
    # Cleanup tasks go to cleanup queue
    'app.tasks.cleanup_tasks.cleanup_expired_otps': {'queue': 'cleanup'},
    'app.tasks.cleanup_tasks.cleanup_expired_tokens': {'queue': 'cleanup'},
    'app.tasks.cleanup_tasks.cleanup_blacklisted_tokens': {'queue': 'cleanup'},
    'app.tasks.design_tasks.generate_design_base_image': {'queue': 'design'},
    
    # Analytics tasks (future) go to analytics queue
    # 'app.tasks.analytics_tasks.track_user_activity': {'queue': 'analytics'},
}

# Task priorities (higher number = higher priority)
CELERY_TASK_PRIORITIES = {
    'email': 8,      # High priority - user-facing
    'cleanup': 3,    # Low priority - maintenance
    'analytics': 5,    # Medium priority - reporting
    'design': 6,     # Design generation jobs
}

# Task time limits in seconds
CELERY_TASK_TIME_LIMITS = {
    'email': 300,      # 5 minutes for email sending
    'cleanup': 600,    # 10 minutes for cleanup tasks
    'analytics': 120,   # 2 minutes for analytics
}

# Schedule configurations
SCHEDULE_CONFIG = {
    # Cleanup schedules
    'cleanup_otps': {
        'task': 'app.tasks.cleanup_tasks.cleanup_expired_otps',
        'schedule': crontab(minute=0),  # Every hour
        'options': {'queue': 'cleanup'}
    },
    'cleanup_tokens': {
        'task': 'app.tasks.cleanup_tasks.cleanup_expired_tokens', 
        'schedule': crontab(minute=0, hour='*/6'),  # Every 6 hours
        'options': {'queue': 'cleanup'}
    },
    'cleanup_blacklist': {
        'task': 'app.tasks.cleanup_tasks.cleanup_blacklisted_tokens',
        'schedule': crontab(minute=0, hour=2),  # Daily at 2 AM
        'options': {'queue': 'cleanup'}
    }
}

# Worker configuration
WORKER_CONFIG = {
    'concurrency': settings.CELERY_WORKER_CONCURRENCY if hasattr(settings, 'CELERY_WORKER_CONCURRENCY') else 4,
    'prefetch_multiplier': 1,
    'max_tasks_per_child': 1000,
    'max_memory_per_child': 200000,  # 200MB
}
