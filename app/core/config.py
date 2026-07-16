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
    MAX_ACTIVE_DEVICES: int = 1
    
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
    
    # Account Lockout (Redis-based)
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15

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
    CELERY_TIMEZONE: str = "America/Chicago"
    CELERY_ENABLE_UTC: bool = False
    # Worker concurrency + memory safety. High-quality image tasks (pro+2K ~210MB, 4K ~356MB working
    # set; child RSS incl. interpreter ~0.5-1GB). Server has 32GB RAM, so 4 concurrent is comfortably
    # safe (4 * ~1GB = ~4GB, leaving plenty for API + Redis). Could go higher (6-8) for more throughput.
    # max_memory_per_child is GENEROUS (~1.5GB) so children only recycle on a real leak, NOT after every
    # task (a low value here causes constant child restarts = slow). max_tasks_per_child also recycles.
    CELERY_WORKER_CONCURRENCY: int = 4
    CELERY_MAX_MEMORY_PER_CHILD: int = 1500000  # KiB (~1.46GB); leak safety net, not a per-task killer

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
    # Image model: gemini-3.1-flash-image-preview = "Nano Banana 2" — the EXACT model the Lovable
    # prototype uses (it calls google/gemini-3.1-flash-image-preview). The direct Gemini API exposes BOTH
    # "gemini-3.1-flash-image" (stable) and "...-preview"; they can be different checkpoints, so we use
    # the -preview one to match Lovable like-for-like.
    # Alternatives: "gemini-3-pro-image" / "gemini-3-pro-image-preview" (Nano Banana Pro — higher quality,
    # slower, ~2x cost), "gemini-2.5-flash-image" (older Nano Banana; briefly restored 16-Jul then reverted).
    GEMINI_IMAGE_MODEL: str = "gemini-3.1-flash-image-preview"
    # Output resolution for Gemini image gen ("1K" | "2K" | "4K"). Higher = better quality + more
    # tokens/time. Empty = model default. 2K = 2816x1536 (4x the default pixels).
    GEMINI_IMAGE_SIZE: str = "2K"
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
    
    # Timezone
    TIMEZONE: str = "America/Chicago"

    # Frontend URL
    # FRONTEND_URL: str = "https://z296mjqz-3000.inc1.devtunnels.ms/"
    FRONTEND_URL: str = "https://craftsmanai.app/"


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