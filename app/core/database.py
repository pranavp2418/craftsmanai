from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Convert async URL to sync for database operations
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql+asyncpg://"):
    database_url = database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

engine = create_engine(
    database_url,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    # Force UTF-8 on the client connection so non-ASCII prompt text (em-dashes "—", emoji, accented or
    # Hindi/non-Latin names) is stored instead of raising UnicodeEncodeError on insert (the DB's default
    # client encoding may be ASCII/LATIN1). Without this, a prompt with "—" 500s the refine/create.
    client_encoding="utf8",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Set PostgreSQL timezone to America/Chicago (CST) for all new connections
@event.listens_for(engine, "connect")
def set_timezone_on_connect(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("SET timezone = 'America/Chicago'")
    cursor.close()
    dbapi_connection.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
