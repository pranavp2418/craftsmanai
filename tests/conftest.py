import os
import pytest
import asyncio
from typing import Generator
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from app.core.database import get_db, Base
from app.core.config import settings
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice

# Set testing environment BEFORE importing app
os.environ["TESTING"] = "true"

# Use the same database as the application
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator[Session, None, None]:
    """Override database dependency for tests"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def db():
    """Create database tables if missing using the real database URL from .env"""
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(scope="function")
def db_session(db) -> Generator[Session, None, None]:
    """Create a new database session for each test"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db) -> Generator[TestClient, None, None]:
    """Create test client using the real database from .env"""
    from app.main import fastapi_app as app
    
    # Override database dependency
    app.dependency_overrides[get_db] = override_get_db
    
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Test user data"""
    return {
        "email": "test@example.com",
        "username": "testuser",
        "full_name": "Test User",
        "password": "TestPass123!",
        "whatsapp_number": "+919876543210"
    }


@pytest.fixture
def test_login_data():
    """Test login data"""
    return {
        "email": "test@example.com",
        "password": "TestPass123!",
        "remember_me": False
    }


@pytest.fixture
def create_test_user(db_session):
    """Create an unverified test user"""
    def _create_test_user(**kwargs):
        from app.repositories.user import UserRepository
        
        user_data = {
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "password": "TestPass123!",
            "is_verified": False,  # Unverified by default
            "whatsapp_number": "+919876543210"
        }
        user_data.update(kwargs)
        
        user_repo = UserRepository(db_session)
        
        # Clean up any existing user with this email
        existing_user = user_repo.get_user_by_email(user_data["email"])
        if existing_user:
            db_session.query(OTP).filter(OTP.user_id == existing_user.id).delete()
            db_session.query(RefreshToken).filter(RefreshToken.user_id == existing_user.id).delete()
            db_session.query(UserDevice).filter(UserDevice.user_id == existing_user.id).delete()
            db_session.query(User).filter(User.id == existing_user.id).delete()
            db_session.commit()
        
        # Create new user
        user = user_repo.create_user(
            email=user_data["email"],
            username=user_data["username"],
            full_name=user_data["full_name"],
            password=user_data["password"],
            is_verified=user_data.get("is_verified", False),
            whatsapp_number=user_data.get("whatsapp_number", "")
        )
        return user
    
    return _create_test_user


@pytest.fixture
def create_verified_user(db_session):
    """Create a verified test user"""
    def _create_verified_user(**kwargs):
        from app.repositories.user import UserRepository
        
        user_data = {
            "email": "verified@example.com",
            "username": "verifieduser",
            "full_name": "Verified User",
            "password": "TestPass123!",
            "is_verified": True,  # Verified
            "whatsapp_number": "+919876543210"
        }
        user_data.update(kwargs)
        
        user_repo = UserRepository(db_session)
        
        # Clean up any existing user with this email
        existing_user = user_repo.get_user_by_email(user_data["email"])
        if existing_user:
            db_session.query(OTP).filter(OTP.user_id == existing_user.id).delete()
            db_session.query(RefreshToken).filter(RefreshToken.user_id == existing_user.id).delete()
            db_session.query(UserDevice).filter(UserDevice.user_id == existing_user.id).delete()
            db_session.query(User).filter(User.id == existing_user.id).delete()
            db_session.commit()
        
        # Create new verified user
        user = user_repo.create_user(
            email=user_data["email"],
            username=user_data["username"],
            full_name=user_data["full_name"],
            password=user_data["password"],
            is_verified=user_data.get("is_verified", True),
            whatsapp_number=user_data.get("whatsapp_number", "")
        )
        return user
    
    return _create_verified_user

