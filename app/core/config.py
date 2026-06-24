from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl


class Settings(BaseSettings):
    # Project
    PROJECT_NAME: str = "Craftmen Backend API"
    API_V2_STR: str = "/api/v2"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    
    # Environment
    ENV: str = "development"
    
    # Token Expiration
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 7
    REFRESH_TOKEN_DAYS_REMEMBER: int = 30
    
    # Device Management
    MAX_ACTIVE_DEVICES: int = 5
    
    # Stripe Settings
    STRIPE_API_KEY: str = "sk_test_mock"
    STRIPE_WEBHOOK_SECRET: str = "whsec_mock"

    # Rate Limiting
    RATE_LIMIT_GLOBAL: str = "60/minute"
    RATE_LIMIT_GLOBAL_IP: str = "120/minute"
    RATE_LIMIT_IP: str = "4/minute"      # IP safety net (Layer 1)
    RATE_LIMIT_USER: str = "7/minute"      # User-based strict limit (Layer 2)
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/hour"
    RATE_LIMIT_PASSWORD_RESET: str = "3/hour"
    RATE_LIMIT_PAYMENT: str = "10/minute"

    # Database
    DATABASE_URL: str
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600

    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: List[str] = ["json"]
    CELERY_TIMEZONE: str = "UTC"
    CELERY_ENABLE_UTC: bool = True

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # CORS
    BACKEND_CORS_ORIGINS: List[str]
    # BACKEND_CORS_ORIGINS: List[str] = ["https://craftmenai.txogavideo.in", "http://localhost:3000","https://b38f2wvf-3000.inc1.devtunnels.ms","https://nr201rgm-8000.inc1.devtunnels.ms"]

    # Socket.IO
    SOCKETIO_PATH: str = "/socket.io"
    SOCKETIO_CORS_ALLOWED_ORIGINS: List[str] 
    SOCKETIO_REDIS_ADAPTER: bool = False

    # Server-Sent Events
    SSE_HEARTBEAT_INTERVAL: float = 25.0  # seconds

    # File Storage (Supabase / S3)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "designs"

    # OpenAI / generative AI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_IMAGE_MODEL: str = "gpt-image-1.5"
    # Primary image generator for MAIN generation + REFINEMENT + METAL-COLOUR change.
    # "gemini" -> gemini-2.5-flash-image (fast, ~seconds; falls back to OpenAI on failure).
    # "openai" -> gpt-image-2 (slow, ~minutes). Side ANGLES always use OpenAI regardless.
    IMAGE_PROVIDER: str = "gemini"
    GEMINI_IMAGE_MODEL: str = "gemini-3.1-flash-image"
    # Text / vision ANALYSIS calls (parse gate, OCR, metal detect, spelling, classify, enrich).
    # "gemini" -> GEMINI_TEXT_MODEL via its OpenAI-compatible endpoint; "openai" -> gpt-4o-mini.
    TEXT_LLM_PROVIDER: str = "gemini"
    GEMINI_TEXT_MODEL: str = "gemini-3.1-pro-preview"
    # Prompt FIDELITY: when False (default) the user's TEXT-ONLY prompt is sent VERBATIM to the image
    # model — never LLM-rewritten. Jewelry needs the client's exact words (named fonts like "Road Rage
    # Font", colours, "2 layer" etc.) preserved; the old enrich step paraphrased and dropped them.
    ENRICH_TEXT_PROMPT: bool = False

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    # Twilio Settings
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    # ZeptoMail Email Settings (replaces Gmail SMTP)
    ZEPTOMAIL_API_KEY: Optional[str] = None
    ZEPTOMAIL_FROM_EMAIL: Optional[str] = None
    ZEPTOMAIL_FROM_NAME: str = "CRAFTMEN"
    ZEPTOMAIL_BOUNCE_ADDRESS: Optional[str] = None
    ZEPTOMAIL_API_URL: str = "https://api.zeptomail.com/v1.1/email"
    ZEPTOMAIL_CUSTOMER_EMAIL: str = "designs@craftsmanai.app"
    ZEPTOMAIL_QUOTES_EMAIL: str = "quotes@craftsmanai.app"
    
    # Contact Form Settings
    CONTACT_NOTIFICATION_EMAIL: str = "abhishek@fonixtech.io"
    
    # Frontend URL
    FRONTEND_URL: str = "https://craftmenai.txogavideo.in/"

    # Web Push VAPID Keys
    VAPID_PRIVATE_KEY: Optional[str] = None
    VAPID_PUBLIC_KEY: Optional[str] = None
    VAPID_CLAIM_EMAIL: str = "mailto:noreply@craftsmanai.app"

    @property
    def EMAILS_FROM_EMAIL(self) -> Optional[str]:
        """Backward compatibility - returns ZeptoMail from email"""
        return self.ZEPTOMAIL_FROM_EMAIL

    @property
    def EMAILS_FROM_NAME(self) -> str:
        """Backward compatibility - returns ZeptoMail from name"""
        return self.ZEPTOMAIL_FROM_NAME
        
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()