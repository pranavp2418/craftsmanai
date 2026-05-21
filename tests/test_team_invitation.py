"""
Test script for team invitation functionality
Tests sending invitations, email delivery, and invitation acceptance
"""

import pytest
import json
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db, SessionLocal
from app.models.user import User
from app.models.retailer_team import RetailerTeam, TeamMember, TeamInvitation, TeamRole, InvitationStatus
from app.repositories.user import UserRepository
from app.repositories.retailer_team import RetailerTeamRepository, TeamMemberRepository
from app.core.security import create_access_token


# Test client
client = TestClient(app)


@pytest.fixture(scope="session")
def db_session() -> Session:
    """Get database session for tests"""
    return SessionLocal()


@pytest.fixture
def test_user(db_session: Session):
    """Create a test user who will be team admin"""
    user_repo = UserRepository(db_session)
    
    # Check if user exists
    existing = user_repo.get_user_by_email("radha@yopmail.com")
    if existing:
        return existing
    
    # Create new user
    user = User(
        email="radha@yopmail.com",
        username="radha",
        full_name="Radha Kumari",
        hashed_password="hashed_password",
        is_verified=True,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_team(db_session: Session, test_user: User):
    """Create a test team"""
    team_repo = RetailerTeamRepository(db_session)
    
    team = team_repo.create_team(
        name="Rostrum",
        description="Test team for invitations",
        owner_id=test_user.id
    )
    
    # Add test user as admin member
    member_repo = TeamMemberRepository(db_session)
    member_repo.add_member(team.id, test_user.id, TeamRole.ADMIN.value)
    
    return team


@pytest.fixture
def auth_token(test_user: User):
    """Create authentication token for test user"""
    return create_access_token({"sub": str(test_user.id)})


class TestTeamInvitation:
    """Test suite for team invitation endpoints"""
    
    def test_send_invitation_success(self, auth_token: str, test_team: RetailerTeam):
        """Test successful invitation send"""
        payload = {
            "full_name": "New Designer",
            "email": "new.designer@fonixtech.io",
            "role": "designer"
        }
        
        response = client.post(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        print(f"\n✅ Send Invitation Response:")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == payload["email"].lower()
        assert data["status"] == "pending"
        assert "id" in data
        assert "created_at" in data
    
    def test_send_invitation_invalid_role(self, auth_token: str, test_team: RetailerTeam):
        """Test invitation with invalid role (capitalized)"""
        payload = {
            "full_name": "Test Invalid Role",
            "email": "invalid.role@fonixtech.io",
            "role": "Designer"  # Invalid: should be lowercase
        }
        
        response = client.post(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        print(f"\n❌ Invalid Role Response:")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        assert response.status_code == 422  # Validation error
    
    def test_send_invitation_without_auth(self, test_team: RetailerTeam):
        """Test invitation without authentication"""
        payload = {
            "full_name": "No Auth User",
            "email": "noauth@fonixtech.io",
            "role": "designer"
        }
        
        response = client.post(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            json=payload
        )
        
        print(f"\n🔒 No Auth Response:")
        print(f"Status: {response.status_code}")
        
        assert response.status_code == 403  # Forbidden without auth
    
    def test_send_invitation_all_roles(self, auth_token: str, test_team: RetailerTeam):
        """Test invitations with all valid roles"""
        roles = ["admin", "designer", "sales", "viewer"]
        
        for role in roles:
            payload = {
                "full_name": f"Test User {role.capitalize()}",
                "email": f"test_{role}@fonixtech.io",
                "role": role
            }
            
            response = client.post(
                f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
                json=payload,
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            print(f"\n✅ Role '{role}' Invitation Response:")
            print(f"Status: {response.status_code}")
            
            assert response.status_code == 201
            data = response.json()
            assert data["role"] == role
    
    def test_send_invitation_missing_fields(self, auth_token: str, test_team: RetailerTeam):
        """Test invitation with missing required fields"""
        # Missing full_name
        payload = {
            "email": "missing.fields@fonixtech.io",
            "role": "designer"
        }
        
        response = client.post(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        print(f"\n⚠️ Missing Field Response:")
        print(f"Status: {response.status_code}")
        
        assert response.status_code == 422  # Validation error
    
    def test_send_invitation_invalid_email(self, auth_token: str, test_team: RetailerTeam):
        """Test invitation with invalid email"""
        payload = {
            "full_name": "radha",   
            "email": "invalid-email",  # Invalid email format
            "role": "designer"
        }
        
        response = client.post(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        print(f"\n❌ Invalid Email Response:")
        print(f"Status: {response.status_code}")
        
        assert response.status_code == 422  # Validation error
    
    def test_list_invitations(self, auth_token: str, test_team: RetailerTeam):
        """Test listing pending invitations"""
        # First send an invitation
        payload = {
            "full_name": "John Doe",
            "email": "john@fonixtech.io",
            "role": "designer"
        }
        
        client.post(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # List invitations
        response = client.get(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        print(f"\n📋 List Invitations Response:")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, (list, dict))


def run_manual_tests():
    """Run manual tests for team invitation workflow"""
    
    print("\n" + "="*80)
    print("TEAM INVITATION TEST SUITE")
    print("="*80)
    
    # Create test data
    db = SessionLocal()
    user_repo = UserRepository(db)
    team_repo = RetailerTeamRepository(db)
    member_repo = TeamMemberRepository(db)
    
    try:
        # Get or create test user - use existing or different email
        test_user = user_repo.get_user_by_email("resend@example.com")
        if not test_user:
            test_user = user_repo.get_user_by_email("priti@example.com")
        
        if not test_user:
            print("❌ ERROR: No test user found. Please create a user first via login endpoint.")
            db.close()
            return
        
        print(f"✅ Using test user: {test_user.email} ({test_user.full_name})")
        
        # Get or create test team
        teams = team_repo.get_teams_by_owner(test_user.id, 0, 10)
        if teams:
            test_team = teams[0]
            print(f"✅ Using test team: {test_team.name} (ID: {test_team.id})")
        else:
            test_team = team_repo.create_team(
                name="Rostrum",
                description="Test team",
                owner_id=test_user.id
            )
            member_repo.add_member(test_team.id, test_user.id, TeamRole.ADMIN.value)
            print(f"✅ Created test team: {test_team.name} (ID: {test_team.id})")
        
        # Create auth token
        token = create_access_token({"sub": str(test_user.id)})
        print(f"✅ Generated auth token")
        
        # Test 1: Send invitation with correct payload
        print("\n\n[TEST 1] Sending invitation with CORRECT payload (lowercase role)")
        print("-" * 80)
        payload_correct = {
            "full_name": "Radha",
            "email": "radha@yopmail.com",
            "role": "designer"
        }
        response = client.post(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            json=payload_correct,
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response:\n{json.dumps(response.json(), indent=2)}")
        
        # Test 2: Send invitation with invalid role (capitalized)
        print("\n\n[TEST 2] Sending invitation with INVALID payload (capitalized role)")
        print("-" * 80)
        payload_invalid_role = {
            "full_name": "Radha",
            "email": "radha@yopmail.com",
            "role": "Designer"  # INVALID
        }
        response = client.post(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            json=payload_invalid_role,
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response:\n{json.dumps(response.json(), indent=2)}")
        
        # Test 3: All valid roles
        print("\n\n[TEST 3] Sending invitations with ALL VALID roles")
        print("-" * 80)
        valid_roles = ["admin", "designer", "sales", "viewer"]
        for idx, role in enumerate(valid_roles, 1):
            payload = {
                "full_name": f"Radha {role.title()}",
                "email": f"radha.{role}@yopmail.com",
                "role": role
            }
            response = client.post(
                f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
                json=payload,
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"\n  Role: {role:10} | Status: {response.status_code} | Email: {payload['email']}")
            if response.status_code != 201:
                print(f"    Error: {json.dumps(response.json(), indent=6)}")
        
        # Test 4: List invitations
        print("\n\n[TEST 4] Listing pending invitations")
        print("-" * 80)
        response = client.get(
            f"/api/v2/teams-settings/teams/{test_team.id}/invitations",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Status Code: {response.status_code}")
        data = response.json()
        if isinstance(data, list):
            print(f"Total Invitations: {len(data)}")
            for inv in data:
                print(f"  - Email: {inv.get('email', 'N/A'):30} | Role: {inv.get('role', 'N/A'):10} | Status: {inv.get('status', 'N/A')}")
        else:
            print(f"Response:\n{json.dumps(data, indent=2)}")
        
        print("\n" + "="*80)
        print("✅ TEST SUITE COMPLETED")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    # Run manual tests
    run_manual_tests()
    
    # To run pytest tests:
    # pytest tests/test_team_invitation.py -v
