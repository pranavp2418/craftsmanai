from celery import Celery
from .config import settings

# Create Celery instance
celery_app = Celery(
    "craftmen_backend",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks"]
)

# Configure Celery
celery_app.conf.update(
    task_serializer=settings.CELERY_TASK_SERIALIZER,
    result_serializer=settings.CELERY_RESULT_SERIALIZER,
    accept_content=settings.CELERY_ACCEPT_CONTENT,
    timezone=settings.CELERY_TIMEZONE,
    enable_utc=settings.CELERY_ENABLE_UTC,
    
    # Task routing
    task_routes={
        'app.tasks.rate_limiting.*': {'queue': 'rate_limiting'},
        'app.tasks.notifications.*': {'queue': 'notifications'},
        'app.tasks.analytics.*': {'queue': 'analytics'},
    },
    
    # Task execution settings
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)
