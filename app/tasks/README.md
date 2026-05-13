# Tasks Directory

This directory contains all background tasks for the application using Celery and Redis.

## 📁 Structure

```
app/tasks/
├── __init__.py          # Central task registry
├── base.py             # Base task class and utilities
├── config.py           # Task configuration and routing
├── email_tasks.py       # Email sending tasks
├── cleanup_tasks.py     # Database cleanup tasks
└── README.md           # This documentation
```

## 🚀 Usage

### **Importing Tasks**
```python
# Import specific tasks
from app.tasks.email_tasks import send_signup_otp_email
from app.tasks.cleanup_tasks import cleanup_expired_otps

# Or import all from central registry
from app.tasks import send_signup_otp_email, cleanup_expired_otps
```

### **Calling Tasks**
```python
# Call task asynchronously
send_signup_otp_email.delay(
    to="user@example.com",
    otp="123456",
    user_name="John Doe"
)

# Get task result
result = send_signup_otp_email.AsyncResult(task_id)
```

## 📋 Available Tasks

### **Email Tasks**
- `send_signup_otp_email` - Send signup verification OTP
- `send_password_reset_email` - Send password reset OTP  
- `send_welcome_email` - Send welcome email

### **Cleanup Tasks**
- `cleanup_expired_otps` - Remove expired OTPs (hourly)
- `cleanup_expired_tokens` - Remove expired refresh tokens (6-hourly)
- `cleanup_blacklisted_tokens` - Clean Redis blacklist (daily)

## ⚙️ Configuration

### **Task Queues**
- `email` - High priority email tasks
- `cleanup` - Low priority maintenance tasks
- `analytics` - Medium priority analytics (future)

### **Retry Logic**
- Max 3 retries per task
- Exponential backoff: 60s * (2^retry_count)
- Comprehensive error logging

### **Scheduling**
- Configured in `app/tasks/config.py`
- Automatic registration via Celery Beat
- Timezone-aware scheduling

## 🔧 Running Workers

```bash
# Start worker for all queues
celery -A app.core.celery_app worker --loglevel=info

# Start specific queue workers
celery -A app.core.celery_app worker -Q email --loglevel=info
celery -A app.core.celery_app worker -Q cleanup --loglevel=info

# Start beat scheduler
celery -A app.core.celery_app beat --loglevel=info
```

## 📊 Monitoring

Monitor tasks using:
- Celery Flower: `celery -A app.core.celery_app flower`
- Redis CLI: `redis-cli monitor`
- Application logs: Task execution logs

## 🔄 Adding New Tasks

1. **Create task file** (e.g., `analytics_tasks.py`)
2. **Use base decorator**: `@create_task(name="task_name")`
3. **Add to config**: Update `CELERY_ROUTES` and `SCHEDULE_CONFIG`
4. **Register in `__init__.py`**: Import and expose
5. **Update documentation**: Add to this README

## 🛡️ Best Practices

- ✅ **Idempotent tasks** - Safe to retry
- ✅ **Proper logging** - Clear task status
- ✅ **Error handling** - Graceful failures
- ✅ **Time limits** - Prevent hanging tasks
- ✅ **Queue separation** - Isolate work types
- ✅ **Resource cleanup** - Close DB connections
