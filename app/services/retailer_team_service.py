import logging
import json
import secrets
from typing import Optional, List, Tuple
from datetime import timedelta
from app.core.timezone import now as tz_now
from sqlalchemy.orm import Session

from app.repositories.retailer_team import (
    RetailerTeamRepository, 
    TeamMemberRepository, 
    TeamInvitationRepository,
    TeamRolePermissionRepository
)
from app.schemas.retailer_team import (
    TeamCreate, TeamUpdate, TeamResponse, TeamDetailResponse,
    TeamMemberResponse, TeamMemberUpdate,
    TeamInvitationCreate, InvitationAcceptRequest,
    TeamRolePermissionCreate
)
from app.models.retailer_team import TeamRole as TeamRoleEnum, InvitationStatus
from app.services.email_service import EmailService
from app.core.config import settings

logger = logging.getLogger(__name__)


class TeamService:
    """Service for team operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.repo = RetailerTeamRepository(db)
        self.member_repo = TeamMemberRepository(db)

    def create_team(self, team_data: TeamCreate, owner_id: int) -> TeamDetailResponse:
        """Create a new team"""
        team = self.repo.create_team(
            name=team_data.name,
            description=team_data.description,
            owner_id=owner_id
        )
        
        # Add owner as admin member
        self.member_repo.add_member(team.id, owner_id, TeamRoleEnum.ADMIN.value)
        
        return self._build_team_detail_response(team)

    def get_team(self, team_id: int) -> Optional[TeamDetailResponse]:
        """Get team details"""
        team = self.repo.get_team_by_id(team_id)
        if not team:
            return None
        
        return self._build_team_detail_response(team)

    def get_user_teams(self, user_id: int, skip: int = 0, limit: int = 100) -> List[TeamDetailResponse]:
        """Get all teams for a user"""
        teams = self.repo.get_user_teams(user_id, skip, limit)
        return [self._build_team_detail_response(team) for team in teams]

    def get_owner_teams(self, owner_id: int, skip: int = 0, limit: int = 100) -> List[TeamDetailResponse]:
        """Get all teams owned by a user"""
        teams = self.repo.get_teams_by_owner(owner_id, skip, limit)
        return [self._build_team_detail_response(team) for team in teams]

    def update_team(self, team_id: int, team_data: TeamUpdate) -> Optional[TeamDetailResponse]:
        """Update team details"""
        team = self.repo.update_team(
            team_id=team_id,
            name=team_data.name,
            description=team_data.description
        )
        
        if not team:
            return None
        
        return self._build_team_detail_response(team)

    def delete_team(self, team_id: int) -> bool:
        """Delete a team"""
        return self.repo.delete_team(team_id)

    def _build_team_detail_response(self, team) -> TeamDetailResponse:
        """Build detailed team response"""
        members = self.member_repo.get_team_members(team.id, skip=0, limit=1000)
        
        return TeamDetailResponse(
            id=team.id,
            name=team.name,
            description=team.description,
            owner_id=team.owner_id,
            is_active=team.is_active,
            created_at=team.created_at,
            updated_at=team.updated_at,
            members_count=len(members),
            members=[
                TeamMemberResponse(
                    id=m.id,
                    team_id=m.team_id,
                    user_id=m.user_id,
                    role=m.role.value if hasattr(m.role, 'value') else m.role,
                    is_active=m.is_active,
                    joined_at=m.joined_at,
                    created_at=m.created_at,
                    updated_at=m.updated_at
                )
                for m in members
            ]
        )

    def is_team_member(self, team_id: int, user_id: int) -> bool:
        """Check if user is a team member"""
        member = self.member_repo.get_member(team_id, user_id)
        return member is not None and member.is_active

    def is_team_admin(self, team_id: int, user_id: int) -> bool:
        """Check if user is a team admin"""
        member = self.member_repo.get_member(team_id, user_id)
        if not member or not member.is_active:
            return False
        return member.role == TeamRoleEnum.ADMIN.value

    def is_team_owner(self, team_id: int, user_id: int) -> bool:
        """Check if user is the team owner"""
        team = self.repo.get_team_by_id(team_id)
        return team is not None and team.owner_id == user_id


class TeamMemberService:
    """Service for team member operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.member_repo = TeamMemberRepository(db)
        self.team_repo = RetailerTeamRepository(db)

    def add_member(self, team_id: int, user_id: int, role: str = "viewer") -> Optional[TeamMemberResponse]:
        """Add a member to a team"""
        # Validate team exists
        team = self.team_repo.get_team_by_id(team_id)
        if not team:
            raise ValueError(f"Team {team_id} not found")
        
        # Validate role
        if role not in [r.value for r in TeamRoleEnum]:
            raise ValueError(f"Invalid role: {role}")
        
        member = self.member_repo.add_member(team_id, user_id, role)
        return self._build_member_response(member)

    def get_member(self, team_id: int, user_id: int) -> Optional[TeamMemberResponse]:
        """Get a team member"""
        member = self.member_repo.get_member(team_id, user_id)
        if not member:
            return None
        return self._build_member_response(member)

    def get_team_members(self, team_id: int, skip: int = 0, limit: int = 100) -> List[TeamMemberResponse]:
        """Get all members of a team"""
        members = self.member_repo.get_team_members(team_id, skip, limit)
        return [self._build_member_response(m) for m in members]

    def update_member_role(self, team_id: int, user_id: int, member_data: TeamMemberUpdate) -> Optional[TeamMemberResponse]:
        """Update a member's role"""
        # Validate role
        if member_data.role.value not in [r.value for r in TeamRoleEnum]:
            raise ValueError(f"Invalid role: {member_data.role.value}")
        
        member = self.member_repo.update_member_role(team_id, user_id, member_data.role.value)
        if not member:
            return None
        return self._build_member_response(member)

    def remove_member(self, team_id: int, user_id: int) -> bool:
        """Remove a member from a team"""
        return self.member_repo.remove_member(team_id, user_id)

    def get_members_count(self, team_id: int) -> int:
        """Get count of members in a team"""
        return self.member_repo.get_team_members_count(team_id)

    def _build_member_response(self, member) -> TeamMemberResponse:
        """Build member response"""
        return TeamMemberResponse(
            id=member.id,
            team_id=member.team_id,
            user_id=member.user_id,
            role=member.role.value if hasattr(member.role, 'value') else member.role,
            is_active=member.is_active,
            joined_at=member.joined_at,
            created_at=member.created_at,
            updated_at=member.updated_at
        )


class TeamInvitationService:
    """Service for team invitation operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.repo = TeamInvitationRepository(db)
        self.team_repo = RetailerTeamRepository(db)
        self.member_repo = TeamMemberRepository(db)
        self.invitation_expiry_hours = 7  # 7 days for invitation validity

    def create_invitation(self, team_id: int, invitation_data: TeamInvitationCreate, 
                         invited_by_id: int, send_email: bool = True) -> Optional[dict]:
        """Create and send an invitation"""
        # Validate team exists
        team = self.team_repo.get_team_by_id(team_id)
        if not team:
            raise ValueError(f"Team {team_id} not found")
        
        # Validate role
        if invitation_data.role.value not in [r.value for r in TeamRoleEnum]:
            raise ValueError(f"Invalid role: {invitation_data.role.value}")
        
        # Check if email is already a member
        from app.repositories.user import UserRepository
        user_repo = UserRepository(self.db)
        existing_user = user_repo.get_user_by_email(invitation_data.email)
        if existing_user:
            existing_member = self.member_repo.get_member(team_id, existing_user.id)
            if existing_member and existing_member.is_active:
                raise ValueError(f"User is already a member of this team")
        
        # Generate invitation token
        token = secrets.token_urlsafe(32)
        expires_at = tz_now() + timedelta(hours=self.invitation_expiry_hours * 24)
        
        # Create invitation
        invitation = self.repo.create_invitation(
            team_id=team_id,
            email=invitation_data.email.lower(),
            full_name=invitation_data.full_name,
            role=invitation_data.role.value,
            invited_by_id=invited_by_id,
            token=token,
            expires_at=expires_at
        )
        
        # Prepare email data for later sending (can be sent asynchronously via Celery)
        if send_email:
            self._queue_invitation_email(team, invitation, invited_by_id)
        
        return {
            "id": invitation.id,
            "full_name": invitation.full_name,
            "email": invitation.email,
            "role": invitation_data.role.value,
            "status": invitation.status.value,
            "expires_at": invitation.expires_at,
            "created_at": invitation.created_at
        }

    def _queue_invitation_email(self, team, invitation, invited_by_id: int):
        """Queue invitation email for sending via Celery"""
        from app.repositories.user import UserRepository
        from app.tasks.email_tasks import send_team_invitation_email
        
        try:
            user_repo = UserRepository(self.db)
            invited_by = user_repo.get_user_by_id(invited_by_id)
            
            if not invited_by:
                logger.error(f"Could not find user {invited_by_id}")
                return
            
            # Build invitation link
            invitation_link = f"{settings.FRONTEND_URL}/teams/accept-invitation?token={invitation.token}"
            
            # Email variables
            variables = {
                "invited_name": invitation.full_name or "Team Member",
                "team_name": team.name,
                "invited_by_name": invited_by.full_name or invited_by.username,
                "role": invitation.role,
                "invitation_link": invitation_link,
                "expires_in_days": self.invitation_expiry_hours * 24
            }
            
            # Queue email sending task
            send_team_invitation_email.delay(invitation.email, team.name, variables)
            logger.info(f"Queued invitation email to {invitation.email} for team {team.name}")
        except Exception as e:
            logger.error(f"Failed to queue invitation email: {str(e)}")
            # Don't raise - invitation should be created even if email fails

    def get_invitation(self, invitation_id: int) -> Optional[dict]:
        """Get invitation details"""
        invitation = self.repo.get_invitation_by_id(invitation_id)
        if not invitation:
            return None
        
        return self._build_invitation_response(invitation)

    def get_pending_invitations_for_email(self, email: str) -> List[dict]:
        """Get pending invitations for an email"""
        invitations = self.repo.get_pending_invitations_for_email(email)
        return [self._build_invitation_response(inv) for inv in invitations]

    def accept_invitation(self, token: str, user_id: int) -> Optional[dict]:
        """Accept an invitation"""
        invitation = self.repo.get_invitation_by_token(token)
        if not invitation:
            raise ValueError("Invalid or expired invitation")
        
        # Check if invitation is still pending
        if invitation.status != InvitationStatus.PENDING:
            raise ValueError(f"Invitation is {invitation.status.value}")
        
        # Check expiration
        if invitation.expires_at < tz_now():
            raise ValueError("Invitation has expired")
        
        # Accept invitation
        accepted = self.repo.accept_invitation(invitation.id, user_id)
        if not accepted:
            raise ValueError("Failed to accept invitation")
        
        # Add user as team member
        self.member_repo.add_member(invitation.team_id, user_id, invitation.role)
        
        return self._build_invitation_response(accepted)

    def decline_invitation(self, invitation_id: int) -> bool:
        """Decline an invitation"""
        invitation = self.repo.decline_invitation(invitation_id)
        return invitation is not None

    def cancel_invitation(self, team_id: int, email: str) -> bool:
        """Cancel pending invitation"""
        return self.repo.cancel_invitation(team_id, email)


    def _build_invitation_response(self, invitation) -> dict:
        """Build invitation response"""
        return {
            "id": invitation.id,
            "team_id": invitation.team_id,
            "email": invitation.email,
            "role": invitation.role.value if hasattr(invitation.role, 'value') else invitation.role,
            "status": invitation.status.value,
            "expires_at": invitation.expires_at,
            "created_at": invitation.created_at,
            "updated_at": invitation.updated_at
        }


class RolePermissionService:
    """Service for role and permission operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.repo = TeamRolePermissionRepository(db)

    def create_role(self, role_data: TeamRolePermissionCreate) -> dict:
        """Create a new role"""
        # Check if role already exists
        existing = self.repo.get_role_by_name(role_data.name)
        if existing:
            raise ValueError(f"Role '{role_data.name}' already exists")
        
        role = self.repo.create_role(
            name=role_data.name,
            display_name=role_data.display_name,
            description=role_data.description,
            permissions=role_data.permissions
        )
        
        return self._build_role_response(role)

    def get_role(self, role_id: int) -> Optional[dict]:
        """Get role details"""
        role = self.repo.get_role_by_id(role_id)
        if not role:
            return None
        
        return self._build_role_response(role)

    def get_role_by_name(self, name: str) -> Optional[dict]:
        """Get role by name"""
        role = self.repo.get_role_by_name(name)
        if not role:
            return None
        
        return self._build_role_response(role)

    def get_all_roles(self, skip: int = 0, limit: int = 100) -> List[dict]:
        """Get all roles"""
        roles = self.repo.get_all_roles(skip, limit)
        return [self._build_role_response(role) for role in roles]

    def get_default_roles(self) -> dict:
        """Get default roles definition"""
        return {
            "admin": {
                "display_name": "Admin",
                "description": "Full access to team",
                "permissions": ["manage_team", "manage_members", "manage_roles", "delete_team", "view_all"]
            },
            "designer": {
                "display_name": "Designer",
                "description": "Can create and manage designs",
                "permissions": ["create_design", "edit_design", "delete_design", "share_design", "view_team"]
            },
            "sales": {
                "display_name": "Sales",
                "description": "Can manage orders and customers",
                "permissions": ["create_order", "edit_order", "manage_customers", "view_team"]
            },
            "viewer": {
                "display_name": "Viewer",
                "description": "Read-only access to team",
                "permissions": ["view_team", "view_designs", "view_orders"]
            }
        }

    def _build_role_response(self, role) -> dict:
        """Build role response"""
        permissions = json.loads(role.permissions) if isinstance(role.permissions, str) else role.permissions
        return {
            "id": role.id,
            "name": role.name,
            "display_name": role.display_name,
            "description": role.description,
            "permissions": permissions,
            "is_active": role.is_active,
            "created_at": role.created_at,
            "updated_at": role.updated_at
        }


class PermissionChecker:
    """Helper class to check permissions"""
    
    ADMIN_PERMISSIONS = ["manage_team", "manage_members", "manage_roles", "delete_team", "view_all"]
    DESIGNER_PERMISSIONS = ["create_design", "edit_design", "delete_design", "share_design", "view_team"]
    SALES_PERMISSIONS = ["create_order", "edit_order", "manage_customers", "view_team"]
    VIEWER_PERMISSIONS = ["view_team", "view_designs", "view_orders"]
    
    @staticmethod
    def get_role_permissions(role: str) -> List[str]:
        """Get permissions for a role"""
        role_permissions = {
            TeamRoleEnum.ADMIN.value: PermissionChecker.ADMIN_PERMISSIONS,
            TeamRoleEnum.DESIGNER.value: PermissionChecker.DESIGNER_PERMISSIONS,
            TeamRoleEnum.SALES.value: PermissionChecker.SALES_PERMISSIONS,
            TeamRoleEnum.VIEWER.value: PermissionChecker.VIEWER_PERMISSIONS,
        }
        return role_permissions.get(role, [])
    
    @staticmethod
    def has_permission(role: str, permission: str) -> bool:
        """Check if role has a specific permission"""
        permissions = PermissionChecker.get_role_permissions(role)
        return permission in permissions
    
    @staticmethod
    def check_permission(role: str, permission: str) -> bool:
        """Check permission and raise error if not authorized"""
        if not PermissionChecker.has_permission(role, permission):
            raise PermissionError(f"Role '{role}' does not have permission '{permission}'")
        return True
