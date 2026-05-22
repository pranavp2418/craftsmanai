import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.team_settings import AccountMember, MemberInvitation, TeamRole
from app.models.user import User
from app.repositories.team_settings import AccountMemberRepository, MemberInvitationRepository
from app.repositories.user import UserRepository
from app.schemas.team_settings import (
    AccountMemberResponse,
    InvitationTokenResponse,
    MemberInvitationCreate,
    MemberSummary,
    MemberUpdateRequest,
    TeamMembersListResponse,
)
from app.tasks.email_tasks import send_team_invitation_email


class TeamSettingsService:
    def __init__(self, db: Session):
        self.db = db
        self.member_repo = AccountMemberRepository(db)
        self.invitation_repo = MemberInvitationRepository(db)
        self.user_repo = UserRepository(db)

    def _require_admin(self, account_id: int, current_user_id: int) -> AccountMember:
        if account_id == current_user_id:
            return self.member_repo.upsert_member(
                account_id=account_id,
                user_id=current_user_id,
                role=TeamRole.admin.value,
                invited_by=None,
            )

        member = self.member_repo.get_active_by_account_and_user(account_id, current_user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a team member")
        if member.role != TeamRole.admin.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        return member

    def _require_member(self, account_id: int, current_user_id: int) -> AccountMember:
        if account_id == current_user_id:
            return self.member_repo.upsert_member(
                account_id=account_id,
                user_id=current_user_id,
                role=TeamRole.admin.value,
                invited_by=None,
            )

        member = self.member_repo.get_active_by_account_and_user(account_id, current_user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a team member")
        return member

    def invite_member(self, payload: MemberInvitationCreate, current_user_id: int) -> InvitationTokenResponse:
        account_id = current_user_id
        self._require_admin(account_id, current_user_id)

        email = payload.email.lower()
        invited_user = self.user_repo.get_user_by_email(email)
        if invited_user:
            existing_member = self.member_repo.get_active_by_account_and_user(account_id, invited_user.id)
            if existing_member:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already a member of this team")

        invitation_account_id = invited_user.id if invited_user else None
        active_invitation = self.invitation_repo.get_active_pending_by_account_and_email(invitation_account_id, email)
        if active_invitation:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An active invitation already exists for this email")

        password_hash = None
        if not invited_user and payload.password:
            password_hash = get_password_hash(payload.password)

        invitation = MemberInvitation(
            account_id=invitation_account_id,
            email=email,
            role=payload.role.value,
            token=secrets.token_urlsafe(32),
            invited_by=current_user_id,
            password=password_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            is_accepted=False,
        )
        self.invitation_repo.create(invitation)

        invited_by = self.user_repo.get_user_by_id(current_user_id)
        workspace_label = self._get_workspace_label(account_id)
        try:
            send_team_invitation_email.delay(
                invitation.email,
                workspace_label,
                {
                    "invited_name": payload.full_name or "Team member",
                    "team_name": workspace_label,
                    "invited_by_name": invited_by.full_name if invited_by and invited_by.full_name else invited_by.username if invited_by else "Team admin",
                    "role": invitation.role,
                    "invitation_link": f"{settings.FRONTEND_URL}/teams-settings/accept-invitation?token={invitation.token}",
                    "expires_in_days": 7,
                },
            )
        except Exception:
            pass

        return InvitationTokenResponse(token=invitation.token)

    def accept_invitation(self, token: str) -> AccountMemberResponse:
        invitation = self.invitation_repo.get_by_token(token)
        if not invitation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired invitation")

        now = datetime.now(timezone.utc)
        if invitation.is_accepted or invitation.expires_at <= now:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation is no longer valid")

        user = self.user_repo.get_user_by_email(invitation.email)
        if not user:
            user = self._create_user_from_invitation(invitation)

        account_id = invitation.invited_by or invitation.account_id
        if account_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation is missing workspace information")

        member = self.member_repo.upsert_member(
            account_id=account_id,
            user_id=user.id,
            role=invitation.role,
            invited_by=invitation.invited_by,
        )
        self.invitation_repo.mark_accepted(invitation)
        return self._member_to_response(member)

    def list_members(self, invited_by: int, current_user_id: int) -> TeamMembersListResponse:
        self._require_member(invited_by, current_user_id)
        members = self.member_repo.list_by_account(invited_by)
        return TeamMembersListResponse(
            account_id=invited_by,
            members_count=len(members),
            members=[self._member_to_response(member) for member in members],
        )

    def update_member(self, invited_by: int, user_id: int, payload: MemberUpdateRequest, current_user_id: int) -> AccountMemberResponse:
        self._require_admin(invited_by, current_user_id)
        member = self.member_repo.get_active_by_account_and_user(invited_by, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

        if payload.role is not None:
            member = self.member_repo.update_role(invited_by, user_id, payload.role.value)
            if not member:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

        return self._member_to_response(member)

    def remove_member(self, invited_by: int, user_id: int, current_user_id: int) -> None:
        self._require_admin(invited_by, current_user_id)

        member = self.member_repo.get_active_by_account_and_user(invited_by, user_id)
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

        if member.role == TeamRole.admin.value and self.member_repo.count_active_admins(invited_by) <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace must have at least one admin")

        removed = self.member_repo.soft_delete(invited_by, user_id)
        if not removed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    def _create_user_from_invitation(self, invitation: MemberInvitation) -> User:
        if not invitation.password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required for new users")

        username = self._generate_username(invitation.email)
        hashed_password = invitation.password
        user = User(
            email=invitation.email.lower(),
            username=username,
            full_name=None,
            hashed_password=hashed_password,
            is_active=True,
            is_verified=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _generate_username(self, email: str) -> str:
        base_username = email.split("@")[0].lower()
        username = base_username
        suffix = 1
        while self.user_repo.username_exists(username):
            username = f"{base_username}{suffix}"
            suffix += 1
        return username

    def _get_workspace_label(self, account_id: int) -> str:
        owner = self.user_repo.get_user_by_id(account_id)
        if not owner:
            return f"workspace-{account_id}"
        return owner.full_name or owner.username or owner.email

    def _member_to_response(self, member: AccountMember) -> AccountMemberResponse:
        user = self.user_repo.get_user_by_id(member.user_id)
        return AccountMemberResponse(
            id=member.id,
            account_id=member.account_id,
            user_id=member.user_id,
            role=TeamRole(member.role),
            invited_by=member.invited_by,
            joined_at=member.joined_at,
            created_at=member.created_at,
            updated_at=member.updated_at,
            status=member.status,
            deleted_at=member.deleted_at,
            user=MemberSummary.from_orm(user) if user else None,
        )

