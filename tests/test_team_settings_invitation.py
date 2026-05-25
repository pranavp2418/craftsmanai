import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.models.team_settings import MemberInvitation


class TestTeamSettingsInvitation:
    def test_invite_existing_user_stores_invitee_id_and_accepts_with_token_only(
        self,
        client: TestClient,
        db_session,
        create_verified_user,
    ):
        current_user = create_verified_user(
            email=f"owner_{uuid.uuid4().hex[:8]}@example.com",
            username=f"owner_{uuid.uuid4().hex[:8]}",
            full_name="Workspace Owner",
        )
        invited_user = create_verified_user(
            email=f"invitee_{uuid.uuid4().hex[:8]}@example.com",
            username=f"invitee_{uuid.uuid4().hex[:8]}",
            full_name="Invited Member",
        )

        async def override_current_user():
            return current_user

        client.app.dependency_overrides[get_current_user] = override_current_user
        try:
            with patch("app.services.team_settings_service.send_team_invitation_email"):
                response = client.post(
                    "/api/v2/teams-settings/invitations",
                    json={
                        "email": invited_user.email,
                        "full_name": "Invited Member",
                        "role": "designer",
                    },
                )

            assert response.status_code == 201
            data = response.json()
            assert data["token"]

            invitation = (
                db_session.query(MemberInvitation)
                .filter(MemberInvitation.email == invited_user.email.lower())
                .first()
            )
            assert invitation is not None
            assert invitation.account_id == current_user.id
            assert invitation.invited_by == current_user.id

            accept_response = client.post(
                "/api/v2/teams-settings/invitations/accept",
                json={
                    "token": data["token"],
                    "password": "TestPassword123",
                    "full_name": "Invited Member"
                },
            )

            assert accept_response.status_code == 200
            accepted_member = accept_response.json()
            assert accepted_member["account_id"] == current_user.id
            assert accepted_member["user_id"] == invited_user.id

            db_session.refresh(invitation)
            assert invitation.is_accepted is True
            assert invitation.accepted_at is not None

            # Verify the invited user's team member fields were set
            db_session.refresh(invited_user)
            assert invited_user.is_team_member is True
            assert invited_user.team_owner_id == current_user.id
        finally:
            client.app.dependency_overrides.clear()

    def test_invite_new_email_leaves_account_id_null_and_accepts_with_token_only(
        self,
        client: TestClient,
        db_session,
        create_verified_user,
    ):
        current_user = create_verified_user(
            email=f"owner_{uuid.uuid4().hex[:8]}@example.com",
            username=f"owner_{uuid.uuid4().hex[:8]}",
            full_name="Workspace Owner",
        )
        invited_email = f"invitee_{uuid.uuid4().hex[:8]}@example.com"

        async def override_current_user():
            return current_user

        client.app.dependency_overrides[get_current_user] = override_current_user
        try:
            with patch("app.services.team_settings_service.send_team_invitation_email"):
                response = client.post(
                    "/api/v2/teams-settings/invitations",
                    json={
                        "email": invited_email,
                        "full_name": "Invited Member",
                        "password": "TestPass123!",
                        "role": "designer",
                    },
                )

            assert response.status_code == 201
            data = response.json()
            assert data["token"]

            invitation = (
                db_session.query(MemberInvitation)
                .filter(MemberInvitation.email == invited_email.lower())
                .first()
            )
            assert invitation is not None
            assert invitation.account_id == current_user.id
            assert invitation.invited_by == current_user.id

            accept_response = client.post(
                "/api/v2/teams-settings/invitations/accept",
                json={
                    "token": data["token"],
                    "password": "TestPassword123",
                    "full_name": "Invited Member"
                },
            )

            assert accept_response.status_code == 200
            accepted_member = accept_response.json()
            assert accepted_member["account_id"] == current_user.id
            assert accepted_member["user"]["email"] == invited_email.lower()

            db_session.refresh(invitation)
            assert invitation.is_accepted is True
            assert invitation.accepted_at is not None

            # Verify the newly created user's team member fields
            from app.models.user import User
            new_user = db_session.query(User).filter(User.email == invited_email.lower()).first()
            assert new_user is not None
            assert new_user.is_team_member is True
            assert new_user.team_owner_id == current_user.id
        finally:
            client.app.dependency_overrides.clear()
