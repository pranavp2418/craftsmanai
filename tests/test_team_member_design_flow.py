"""
Tests for team member design flow:
- When user accepts invitation, is_team_member and team_owner_id are set
- When team member creates a design, user_id = team_owner_id, created_by_user_id = member's id
- Team owner can see all designs (their own + team members')
- Team member can only see designs they personally created
"""
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.models.team_settings import MemberInvitation
from app.models.user import User
from app.models.design import Design
from app.repositories.user import UserRepository
from app.repositories.design import DesignRepository
from app.services.design_service import DesignService


class TestTeamMemberDesignFlow:
    """Test the complete team member design flow."""

    @pytest.fixture
    def owner_user(self, create_verified_user):
        """Create a workspace owner user."""
        return create_verified_user(
            email=f"owner_{uuid.uuid4().hex[:8]}@example.com",
            username=f"owner_{uuid.uuid4().hex[:8]}",
            full_name="Workspace Owner",
        )

    @pytest.fixture
    def member_user(self, create_verified_user):
        """Create a team member user (not yet marked as team member)."""
        return create_verified_user(
            email=f"member_{uuid.uuid4().hex[:8]}@example.com",
            username=f"member_{uuid.uuid4().hex[:8]}",
            full_name="Team Member",
        )

    def _invite_and_accept_member(
        self,
        client: TestClient,
        db_session: Session,
        owner: User,
        member: User,
        role: str = "designer",
    ):
        """Helper to invite a user and accept the invitation via API."""
        async def override_current_user():
            return owner

        client.app.dependency_overrides[get_current_user] = override_current_user
        try:
            with patch("app.services.team_settings_service.send_team_invitation_email"):
                response = client.post(
                    "/api/v2/teams-settings/invitations",
                    json={
                        "email": member.email,
                        "full_name": member.full_name,
                        "role": role,
                    },
                )
            assert response.status_code == 201
            token = response.json()["token"]

            # Now accept as the member
            async def override_member_user():
                return member

            client.app.dependency_overrides[get_current_user] = override_member_user
            accept_response = client.post(
                "/api/v2/teams-settings/invitations/accept",
                json={
                    "token": token,
                    "password": "TestPassword123!",
                    "full_name": member.full_name
                },
            )
            assert accept_response.status_code == 200
            return token
        finally:
            client.app.dependency_overrides.clear()

    def _create_design_for_user(
        self,
        client: TestClient,
        db_session: Session,
        user: User,
        name: str = "Test Design",
    ):
        """Helper to create a design for a user."""
        async def override_current_user():
            return user

        client.app.dependency_overrides[get_current_user] = override_current_user
        try:
            with patch("app.tasks.design_tasks.generate_design_base_image.apply_async"):
                response = client.post(
                    "/api/v2/designs/",
                    data={
                        "name": name,
                        "jewellery_type": "ring",
                        "user_prompt": "A beautiful ring",
                    },
                )
            return response
        finally:
            client.app.dependency_overrides.clear()

    # ========== Tests ==========

    def test_invitation_sets_is_team_member_and_team_owner_id(
        self,
        client: TestClient,
        db_session: Session,
        owner_user: User,
        member_user: User,
    ):
        """Test that after accepting invitation, the member user gets is_team_member=True and team_owner_id set."""
        self._invite_and_accept_member(client, db_session, owner_user, member_user)

        # Refresh member from DB and verify
        db_session.refresh(member_user)
        assert member_user.is_team_member is True
        assert member_user.team_owner_id == owner_user.id

    def test_owner_creates_design_normal_flow(
        self,
        client: TestClient,
        db_session: Session,
        owner_user: User,
    ):
        """Test that when the owner creates a design, user_id = owner.id and created_by_user_id = None."""
        response = self._create_design_for_user(client, db_session, owner_user, "Owner Design")
        assert response.status_code == 201
        data = response.json()

        assert data["user_id"] == owner_user.id
        assert data["created_by_user_id"] is None  # Owner created it themselves

        # Verify in DB
        design = db_session.query(Design).filter(Design.id == data["id"]).first()
        assert design is not None
        assert design.user_id == owner_user.id
        assert design.created_by_user_id is None

    def test_team_member_creates_design_sets_owner_as_user_id(
        self,
        client: TestClient,
        db_session: Session,
        owner_user: User,
        member_user: User,
    ):
        """Test that when a team member creates a design, user_id = team_owner_id and created_by_user_id = member.id."""
        # First make the member a team member
        self._invite_and_accept_member(client, db_session, owner_user, member_user)
        db_session.refresh(member_user)

        # Create design as the team member
        response = self._create_design_for_user(client, db_session, member_user, "Member Design")
        assert response.status_code == 201
        data = response.json()

        # user_id should be the team owner's ID
        assert data["user_id"] == owner_user.id
        # created_by_user_id should be the member's ID
        assert data["created_by_user_id"] == member_user.id

        # Verify in DB
        design = db_session.query(Design).filter(Design.id == data["id"]).first()
        assert design is not None
        assert design.user_id == owner_user.id
        assert design.created_by_user_id == member_user.id

    def test_team_member_creates_then_owner_can_see_it_in_list(
        self,
        client: TestClient,
        db_session: Session,
        owner_user: User,
        member_user: User,
    ):
        """Test that after team member creates a design, the owner can see it when listing designs."""
        self._invite_and_accept_member(client, db_session, owner_user, member_user)
        db_session.refresh(member_user)

        # Member creates a design
        response = self._create_design_for_user(client, db_session, member_user, "Member Design")
        assert response.status_code == 201

        # Owner lists designs - should see it
        async def override_owner():
            return owner_user

        client.app.dependency_overrides[get_current_user] = override_owner
        try:
            list_response = client.get("/api/v2/designs/")
            assert list_response.status_code == 200
            data = list_response.json()
            # Owner should see at least 1 design (the one created by member)
            assert data["total"] >= 1
            design_ids = [item["id"] for item in data["items"]]
            assert response.json()["id"] in design_ids
        finally:
            client.app.dependency_overrides.clear()

    def test_team_member_only_sees_own_designs_in_list(
        self,
        client: TestClient,
        db_session: Session,
        owner_user: User,
        member_user: User,
    ):
        """Test that team member only sees designs they personally created, not other team members' designs."""
        self._invite_and_accept_member(client, db_session, owner_user, member_user)
        db_session.refresh(member_user)

        # Owner creates a design first
        owner_design_resp = self._create_design_for_user(client, db_session, owner_user, "Owner Design")
        assert owner_design_resp.status_code == 201

        # Member creates a design
        member_design_resp = self._create_design_for_user(client, db_session, member_user, "Member Design")
        assert member_design_resp.status_code == 201

        # Member lists designs - should only see their own
        async def override_member():
            return member_user

        client.app.dependency_overrides[get_current_user] = override_member
        try:
            list_response = client.get("/api/v2/designs/")
            assert list_response.status_code == 200
            data = list_response.json()
            # Member should see 1 design (the one they created)
            assert data["total"] == 1
            assert data["items"][0]["id"] == member_design_resp.json()["id"]
        finally:
            client.app.dependency_overrides.clear()

    def test_team_member_can_get_own_design_by_id(
        self,
        client: TestClient,
        db_session: Session,
        owner_user: User,
        member_user: User,
    ):
        """Test that team member can GET/fetch their own design by ID."""
        self._invite_and_accept_member(client, db_session, owner_user, member_user)
        db_session.refresh(member_user)

        # Member creates a design
        create_resp = self._create_design_for_user(client, db_session, member_user, "Member Design")
        assert create_resp.status_code == 201
        design_id = create_resp.json()["id"]

        # Member gets the design
        async def override_member():
            return member_user

        client.app.dependency_overrides[get_current_user] = override_member
        try:
            get_response = client.get(f"/api/v2/designs/{design_id}")
            assert get_response.status_code == 200
            data = get_response.json()
            assert data["id"] == design_id
            assert data["user_id"] == owner_user.id
            assert data["created_by_user_id"] == member_user.id
        finally:
            client.app.dependency_overrides.clear()

    def test_team_member_cannot_access_owner_direct_design(
        self,
        client: TestClient,
        db_session: Session,
        owner_user: User,
        member_user: User,
    ):
        """Test that team member cannot access a design that the owner created directly (not created by the member)."""
        self._invite_and_accept_member(client, db_session, owner_user, member_user)
        db_session.refresh(member_user)

        # Owner creates a design directly
        owner_design_resp = self._create_design_for_user(client, db_session, owner_user, "Owner Only Design")
        assert owner_design_resp.status_code == 201
        owner_design_id = owner_design_resp.json()["id"]

        # Member tries to get the owner's design - should fail with 404
        async def override_member():
            return member_user

        client.app.dependency_overrides[get_current_user] = override_member
        try:
            get_response = client.get(f"/api/v2/designs/{owner_design_id}")
            assert get_response.status_code == 404
        finally:
            client.app.dependency_overrides.clear()

    def test_owner_can_see_team_member_design_by_id(
        self,
        client: TestClient,
        db_session: Session,
        owner_user: User,
        member_user: User,
    ):
        """Test that team owner can GET/fetch a design created by a team member."""
        self._invite_and_accept_member(client, db_session, owner_user, member_user)
        db_session.refresh(member_user)

        # Member creates a design
        member_design_resp = self._create_design_for_user(client, db_session, member_user, "Member Design")
        assert member_design_resp.status_code == 201
        design_id = member_design_resp.json()["id"]

        # Owner gets the design created by member
        async def override_owner():
            return owner_user

        client.app.dependency_overrides[get_current_user] = override_owner
        try:
            get_response = client.get(f"/api/v2/designs/{design_id}")
            assert get_response.status_code == 200
            data = get_response.json()
            assert data["id"] == design_id
            assert data["user_id"] == owner_user.id
            assert data["created_by_user_id"] == member_user.id
        finally:
            client.app.dependency_overrides.clear()


class TestDesignOwnerResolution:
    """Unit tests for the _resolve_owner_id method."""

    def test_regular_user_returns_own_id(self, db_session, create_verified_user):
        """Test that a regular user's resolve returns their own id with created_by=None."""
        user = create_verified_user(
            email=f"regular_{uuid.uuid4().hex[:8]}@example.com",
            username=f"regular_{uuid.uuid4().hex[:8]}",
            is_verified=True,
        )
        service = DesignService(db_session)
        owner_id, created_by_id = service._resolve_owner_id(user)
        assert owner_id == user.id
        assert created_by_id is None

    def test_team_member_returns_owner_id(self, db_session, create_verified_user):
        """Test that a team member's resolve returns the team owner's id with created_by=member.id."""
        owner = create_verified_user(
            email=f"test_owner_{uuid.uuid4().hex[:8]}@example.com",
            username=f"test_owner_{uuid.uuid4().hex[:8]}",
            is_verified=True,
        )
        member = create_verified_user(
            email=f"test_member_{uuid.uuid4().hex[:8]}@example.com",
            username=f"test_member_{uuid.uuid4().hex[:8]}",
            is_verified=True,
        )
        # Manually set team member fields
        member.is_team_member = True
        member.team_owner_id = owner.id
        db_session.commit()

        service = DesignService(db_session)
        owner_id, created_by_id = service._resolve_owner_id(member)
        assert owner_id == owner.id
        assert created_by_id == member.id


class TestTeamMemberRepository:
    """Tests for the team-aware repository methods."""

    def test_get_next_sequence_number_maintains_per_owner_separate(
        self, db_session, create_verified_user
    ):
        """Test that sequence numbers are tracked by user_id (owner), not the actual creator."""
        owner = create_verified_user(
            email=f"seq_owner_{uuid.uuid4().hex[:8]}@example.com",
            username=f"seq_owner_{uuid.uuid4().hex[:8]}",
            is_verified=True,
            full_name="Seq Owner",
        )
        member = create_verified_user(
            email=f"seq_member_{uuid.uuid4().hex[:8]}@example.com",
            username=f"seq_member_{uuid.uuid4().hex[:8]}",
            is_verified=True,
            full_name="Seq Member",
        )
        member.is_team_member = True
        member.team_owner_id = owner.id
        db_session.commit()

        repo = DesignRepository(db_session)
        service = DesignService(db_session)

        # Owner creates a design - gets sequence 1
        owner_design = service.create_design(
            user=owner,
            name="Owner Design 1",
            jewellery_type="ring",
            user_prompt="test",
        )
        assert owner_design.sequence_number == 1
        assert owner_design.user_id == owner.id

        # Member creates a design - gets sequence 2 (shared with owner)
        member_design = service.create_design(
            user=member,
            name="Member Design 1",
            jewellery_type="ring",
            user_prompt="test",
        )
        assert member_design.sequence_number == 2
        assert member_design.user_id == owner.id
        assert member_design.created_by_user_id == member.id

        # Owner creates another - gets sequence 3
        owner_design2 = service.create_design(
            user=owner,
            name="Owner Design 2",
            jewellery_type="ring",
            user_prompt="test",
        )
        assert owner_design2.sequence_number == 3

    def test_list_by_created_by_returns_only_member_designs(
        self, db_session, create_verified_user
    ):
        """Test that list_by_created_by returns only designs created by the specific team member."""
        owner = create_verified_user(
            email=f"list_owner_{uuid.uuid4().hex[:8]}@example.com",
            username=f"list_owner_{uuid.uuid4().hex[:8]}",
            is_verified=True,
            business_name="Test Biz Test",
        )
        member = create_verified_user(
            email=f"list_member_{uuid.uuid4().hex[:8]}@example.com",
            username=f"list_member_{uuid.uuid4().hex[:8]}",
            is_verified=True,
            business_name="Test Biz Member",
        )
        member.is_team_member = True
        member.team_owner_id = owner.id
        db_session.commit()

        service = DesignService(db_session)
        repo = DesignRepository(db_session)

        # Create designs: owner makes 1, member makes 2
        service.create_design(user=owner, name="O1", jewellery_type="ring", user_prompt="t")
        service.create_design(user=member, name="M1", jewellery_type="ring", user_prompt="t")
        service.create_design(user=member, name="M2", jewellery_type="ring", user_prompt="t")

        # list_by_created_by for member should return 2
        member_designs = repo.list_by_created_by(member.id, owner.id)
        assert len(member_designs) == 2
        for d in member_designs:
            assert d.created_by_user_id == member.id
            assert d.user_id == owner.id

        # list_by_user for owner should return 3
        owner_designs = repo.list_by_user(owner.id)
        assert len(owner_designs) == 3
        for d in owner_designs:
            assert d.user_id == owner.id

    def test_get_by_id_for_team_member_access_control(
        self, db_session, create_verified_user
    ):
        """Test get_by_id_for_team_member correctly filters access."""
        owner = create_verified_user(
            email=f"access_owner_{uuid.uuid4().hex[:8]}@example.com",
            username=f"access_owner_{uuid.uuid4().hex[:8]}",
            is_verified=True,
            business_name="Access Test",
        )
        member1 = create_verified_user(
            email=f"access_m1_{uuid.uuid4().hex[:8]}@example.com",
            username=f"access_m1_{uuid.uuid4().hex[:8]}",
            is_verified=True,
            business_name="Access M1",
        )
        member2 = create_verified_user(
            email=f"access_m2_{uuid.uuid4().hex[:8]}@example.com",
            username=f"access_m2_{uuid.uuid4().hex[:8]}",
            is_verified=True,
            business_name="Access M2",
        )
        member1.is_team_member = True
        member1.team_owner_id = owner.id
        member2.is_team_member = True
        member2.team_owner_id = owner.id
        db_session.commit()

        service = DesignService(db_session)
        repo = DesignRepository(db_session)

        # Owner creates design O1
        d_owner = service.create_design(user=owner, name="O1", jewellery_type="ring", user_prompt="t")
        # Member1 creates design M1
        d_m1 = service.create_design(user=member1, name="M1", jewellery_type="ring", user_prompt="t")

        # Member1 can access their own design M1
        result = repo.get_by_id_for_team_member(d_m1.id, member1.id, owner.id)
        assert result is not None
        assert result.id == d_m1.id

        # Member1 cannot access owner's design O1 (not created by member1)
        result = repo.get_by_id_for_team_member(d_owner.id, member1.id, owner.id)
        assert result is None

        # Member2 cannot access member1's design M1
        result = repo.get_by_id_for_team_member(d_m1.id, member2.id, owner.id)
        assert result is None

        # Owner can access all designs via get_by_id_for_user
        result = repo.get_by_id_for_user(d_owner.id, owner.id)
        assert result is not None
        result = repo.get_by_id_for_user(d_m1.id, owner.id)
        assert result is not None