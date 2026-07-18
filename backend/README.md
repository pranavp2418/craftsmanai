# Craftmen Backend v2

A production-ready FastAPI backend with comprehensive authentication, rate limiting, and logging.

## Features

### Authentication & Security
- **JWT Authentication** with access tokens (15min) and refresh tokens (7/30 days)
- **Device Management** with configurable active device limits
- **Password Security** with bcrypt hashing and validation
- **Rate Limiting** with Redis backend for authentication endpoints
- **Password Reset** functionality with secure tokens

### Architecture
- **Clean Architecture** following SOLID principles
- **Layered Design**: API → Service → Repository → Database
- **Dependency Injection** throughout the application
- **Comprehensive Logging** with structured logs
- **Database Migrations** with Alembic

### Infrastructure
- **Redis** for rate limiting and caching
- **Celery** for background tasks
- **PostgreSQL** as primary database
- **Pytest** for comprehensive testing

## Project Structure

```
app/
├── main.py                    # FastAPI app with middleware
├── core/                      # Core functionality
│   ├── config.py             # Settings management
│   ├── security.py           # JWT, password hashing
│   ├── dependencies.py       # FastAPI dependencies
│   ├── database.py           # Database configuration
│   ├── middleware.py         # Custom middleware
│   ├── rate_limiter.py       # Rate limiting logic
│   └── celery_app.py         # Celery configuration
├── models/                    # SQLAlchemy models
│   └── user.py               # User, Device, Token models
├── schemas/                   # Pydantic schemas
│   └── auth.py               # Authentication schemas
├── repositories/              # Data access layer
│   └── user.py               # User CRUD operations
├── services/                  # Business logic
│   └── auth.py               # Authentication service
└── api/v2/
    ├── router.py             # Main API router
    └── endpoints/
        ├── router.py         # Endpoint router
        └── auth.py           # Authentication endpoints
```

## Environment Setup

1. **Copy environment configuration:**
```bash
cp .env.example .env
```

2. **Configure your environment variables:**
```env
# Database
DATABASE_URL=postgresql://user:password@localhost/craftmen_db

# Security
SECRET_KEY=your-super-secret-key-here-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_DAYS=7
REFRESH_TOKEN_DAYS_REMEMBER=30

# Device Management
MAX_ACTIVE_DEVICES=5

# Redis & Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Rate Limiting
RATE_LIMIT_AUTH=5/minute
RATE_LIMIT_REGISTER=3/hour
```

## Installation

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Set up Redis:**
```bash
# Start Redis server
redis-server
```

3. **Set up PostgreSQL:**
```bash
# Create database
createdb craftmen_db
```

4. **Run database migrations:**
```bash
# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head
```

## Running the Application

1. **Start the FastAPI server:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. **Start Celery worker (optional):**
```bash
celery -A app.core.celery_app worker --loglevel=info
```

## API Endpoints

### Authentication
- `POST /api/v2/auth/register` - Register new user
- `POST /api/v2/auth/login` - User login
- `POST /api/v2/auth/refresh` - Refresh access token
- `POST /api/v2/auth/logout` - Logout user
- `POST /api/v2/auth/logout-all` - Logout from all devices
- `GET /api/v2/auth/me` - Get current user info
- `PUT /api/v2/auth/me` - Update user profile
- `POST /api/v2/auth/change-password` - Change password
- `GET /api/v2/auth/devices` - Get user devices
- `DELETE /api/v2/auth/devices/{device_id}` - Revoke device
- `POST /api/v2/auth/password-reset` - Request password reset
- `POST /api/v2/auth/password-reset/confirm` - Confirm password reset

### Health Check
- `GET /api/v2/endpoints/health` - Application health status

## Testing

Run the test suite:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=app --cov-report=html
```

## Rate Limiting

The application implements comprehensive rate limiting:

- **Global Rate Limit**: 60 requests per minute
- **IP-based Rate Limit**: 120 requests per minute  
- **Authentication Endpoints**: 5 requests per minute
- **Registration**: 3 requests per hour
- **Password Reset**: 3 requests per hour

Rate limiting is implemented using Redis and includes proper HTTP headers.

## Security Features

### JWT Tokens
- **Access Tokens**: 15 minutes expiration
- **Refresh Tokens**: 7 days (30 days with "remember me")
- **Token Types**: Separate access and refresh tokens
- **Secure Storage**: Refresh tokens stored in HTTP-only cookies

### Device Management
- **Device Tracking**: Automatic device detection
- **Active Limits**: Configurable maximum active devices
- **Device Revocation**: Individual and bulk device management
- **Security**: Automatic cleanup of old devices

### Password Security
- **Bcrypt Hashing**: Secure password storage
- **Validation**: Strong password requirements
- **Length Limits**: Protection against bcrypt truncation
- **Reset Tokens**: Secure password reset flow

## Logging

Comprehensive logging with:
- **Request/Response Logging**: All API calls logged
- **Security Events**: Login attempts, failures, etc.
- **Performance Metrics**: Request timing
- **Structured Logs**: JSON format for easy parsing
- **File & Console**: Dual output configuration

## Development Rules

See `DEVELOPMENT_RULES.md` for comprehensive development guidelines including:
- SOLID principles implementation
- Architecture patterns
- Code organization standards
- Testing requirements

## Production Deployment

### Environment Variables
Ensure all sensitive configuration is set via environment variables:
- `SECRET_KEY`: Use a strong, unique key
- `DATABASE_URL`: Production database connection
- `REDIS_URL`: Production Redis connection

### Security Headers
The application includes security middleware for:
- XSS Protection
- Content Type Options
- Frame Options
- Referrer Policy

### Database
- Use connection pooling
- Enable SSL connections
- Regular backups
- Migration management

## Contributing

1. Follow the development rules in `DEVELOPMENT_RULES.md`
2. Write comprehensive tests for new features
3. Ensure all tests pass before submitting
4. Follow the existing code style and patterns

## License

[Add your license here]