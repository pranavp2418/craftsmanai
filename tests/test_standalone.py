import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import requests

# Direct database connection
from app.core.config import settings
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def client():
    """Create test client without app dependencies"""
    # Create a simple FastAPI app for testing
    from fastapi import FastAPI
    from app.api.v2.endpoints.auth import login as login_endpoint
    from app.core.database import get_db
    from app.repositories.user import UserRepository
    from app.models.user import User
    from app.schemas.auth import LoginResponse
    
    test_app = FastAPI()
    
    # Override database dependency
    @test_app.dependency_overrides[get_db]
    def override_get_db():
        db = TestingSessionLocal()
        yield db
        db.close()
    
    # Include just the login endpoint
    test_app.include_router(login_endpoint.router, prefix="/auth")
    
    with TestClient(test_app) as test_client:
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

class TestStandalone:
    """Standalone test without dependency issues"""
    
    def test_login_standalone(self, client, test_user_data):
        """Test login with standalone setup"""
        print("🔧 Creating user directly...")
        
        # Create user directly
        db = client.app.dependency_overrides[get_db]()
        user_repo = UserRepository(db)
        
        # Clean up existing user
        existing_user = user_repo.get_user_by_email(test_user_data["email"])
        if existing_user:
            db.delete(existing_user)
            db.commit()
        
        # Create new user
        user = user_repo.create_user(
            email=test_user_data["email"],
            username=test_user_data["username"],
            full_name=test_user_data["full_name"],
            password=test_user_data["password"]
        )
        
        # Make user is_verified
        user.is_verified = True
        db.commit()
        
        print(f"✅ Created user: {user.email}")
        
        # Test login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "remember_me": False
        }
        
        print(f"🔍 Testing login with: {login_data}")
        response = client.post("/auth/login", json=login_data)
        
        print(f"📊 Login response status: {response.status_code}")
        print(f"📊 Login response: {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Login successful! Token: {data.get('access_token', 'N/A')[:20]}...")
        
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
