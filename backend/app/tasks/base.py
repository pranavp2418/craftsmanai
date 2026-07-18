"""
Base task configuration and utilities
Common functionality for all Celery tasks
"""

from celery import Celery
from app.core.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


class BaseTask(celery_app.Task):
    """
    Base class for all Celery tasks
    Provides common functionality and error handling
    """
    
    def on_success(self, retval, task_id, args, kwargs):
        """Called when task succeeds"""
        logger.info(f"✅ Task {self.name} ({task_id}) completed successfully")
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails"""
        logger.error(f"❌ Task {self.name} ({task_id}) failed: {str(exc)}")
        super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Called when task is retried"""
        retry_count = self.request.retries + 1
        logger.warning(f"🔄 Task {self.name} ({task_id}) retry {retry_count}/{self.max_retries}")


def create_task(name: str, bind: bool = True, max_retries: int = 3, base_class: type = None):
    """
    Factory function to create consistent tasks
    
    Args:
        name: Task name for logging
        bind: Whether to bind task instance
        max_retries: Maximum retry attempts
        base_class: Custom base class (defaults to BaseTask)
    
    Returns:
        Decorated task function
    """
    def decorator(func):
        return celery_app.task(
            bind=bind,
            max_retries=max_retries,
            base=base_class or BaseTask,
            name=name,
            default_retry_delay=60
        )(func)
    
    return decorator
