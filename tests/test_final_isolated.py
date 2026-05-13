import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use PostgreSQL database from config
from app.core.config import settings
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    """Create database tables"""
    from app.core.database import Base
    from app.models import user, refresh_token, user_device, otp  # Import all models
    
    # Create tables if they don't exist
    print(f"🔧 Creating database tables using PostgreSQL")
    Base.metadata.create_all(bind=engine)
    
    # Verify tables were created
    print(f"📋 Available tables: {list(Base.metadata.tables.keys())}")
    
    yield
    # Don't drop tables - keep them for other tests

@pytest.fixture
def db_session(db):
    """Create database session"""
    session = TestingSessionLocal()
    yield session
    session.close()

@pytest.fixture
def client(db_session):
    """Create test client with direct database session"""
    from app.main import app
    
    # Don't use dependency overrides - pass session directly to repositories
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def test_user_data():
    """Test user data"""
    return {
        "email": "test@example.com",
        "username": "testuser",
        "full_name": "Test User",
        "password": "TestPass123!",
        "whatsapp_number": "+1234567890"
    }

class TestFinalIsolated:
    """Final isolated test without dependency override issues"""
    
    def test_login_final(self, client, test_user_data):
        """Final test - direct session usage"""
        # Create user directly using the session
        from app.repositories.user import UserRepository
        from app.models.user import User
        
        user_repo = UserRepository(db_session)
        
        # Clean up existing user
        existing_user = user_repo.get_user_by_email(test_user_data["email"])
        if existing_user:
            user_repo.db.delete(existing_user)
            user_repo.db.commit()
        
        # Create new user
        user = user_repo.create_user(
            email=test_user_data["email"],
            username=test_user_data["username"],
            full_name=test_user_data["full_name"],
            password=test_user_data["password"]
        )
        
        # Make user is_verified
        user.is_verified = True
        user_repo.db.commit()
        
        print(f"✅ Created user: {user.email}")
        
        # Now test login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "remember_me": False
        }
        
        print(f"🔍 Attempting login with: {login_data}")
        response = client.post("/api/v2/auth/login", json=login_data)
        
        print(f"📊 Login response status: {response.status_code}")
        print(f"📊 Login response: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ Login failed: {response.text}")
        else:
            data = response.json()
            print(f"✅ Login successful! Token: {data.get('access_token', 'N/A')}")
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
