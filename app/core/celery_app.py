from celery import Celery
from .config import settings

# Create Celery instance
celery_app = Celery(
    "craftmen_backend",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.email_tasks",
        "app.tasks.cleanup_tasks",
        "app.tasks.design_tasks",
        "app.tasks.metal_variant_tasks",
        "app.tasks.resend_manufacturer_share_task",
    ]
)

# Load routing and schedule configurations (imported here to avoid circular dependencies)
from app.tasks.config import CELERY_ROUTES, SCHEDULE_CONFIG

# Configure Celery
celery_app.conf.update(
    task_serializer=settings.CELERY_TASK_SERIALIZER,
    result_serializer=settings.CELERY_RESULT_SERIALIZER,
    accept_content=settings.CELERY_ACCEPT_CONTENT,
    timezone=settings.CELERY_TIMEZONE,
    enable_utc=settings.CELERY_ENABLE_UTC,

    # Task routing
    task_routes=CELERY_ROUTES,

    # Periodic schedules
    beat_schedule=SCHEDULE_CONFIG,

    # Task execution settings
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,

    # CONCURRENCY + MEMORY SAFETY (critical): each high-quality image task (pro + 2K) peaks at
    # ~210MB RAM (4K ~356MB). Without a cap, several simultaneous generations exhaust the server's
    # RAM -> the OS OOM-killer kills the worker child mid-task -> the design is left stuck in
    # GENERATING forever (no error). Capping concurrency makes simultaneous requests QUEUE and run a
    # few at a time instead of all at once; max_memory_per_child recycles a bloated child after a task.
    # Tune via env: CELERY_WORKER_CONCURRENCY (raise if the server has more RAM) and
    # CELERY_MAX_MEMORY_PER_CHILD (KiB). NOTE: a `-c N` flag on the celery launch command OVERRIDES
    # worker_concurrency — make the launch command's -c match this (or drop it to use this value).
    worker_concurrency=getattr(settings, "CELERY_WORKER_CONCURRENCY", 2),
    worker_max_memory_per_child=getattr(settings, "CELERY_MAX_MEMORY_PER_CHILD", 250000),  # KiB (~244MB)
)
