from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from app.models.retailer_team import RetailerTeam, TeamMember, TeamInvitation, TeamRole, TeamRolePermission, InvitationStatus, TeamRole as TeamRoleEnum
from app.models.user import User


class RetailerTeamRepository:
    """Repository for retailer team operations"""
    
    def __init__(self, db: Session):
        self.db = db

    def create_team(self, name: str, description: str, owner_id: int) -> RetailerTeam:
        """Create a new team"""
        team = RetailerTeam(
            name=name,
            description=description,
            owner_id=owner_id,
            is_active=True
        )
        self.db.add(team)
        self.db.commit()
        self.db.refresh(team)
        return team

    def get_team_by_id(self, team_id: int) -> Optional[RetailerTeam]:
        """Get team by ID"""
        return self.db.query(RetailerTeam).filter(RetailerTeam.id == team_id).first()

    def get_teams_by_owner(self, owner_id: int, skip: int = 0, limit: int = 100) -> List[RetailerTeam]:
        """Get all teams owned by a user"""
        return self.db.query(RetailerTeam)\
            .filter(RetailerTeam.owner_id == owner_id, RetailerTeam.is_active == True)\
            .offset(skip)\
            .limit(limit)\
            .all()

    def get_user_teams(self, user_id: int, skip: int = 0, limit: int = 100) -> List[RetailerTeam]:
        """Get all teams for a user (as owner or member)"""
        return self.db.query(RetailerTeam)\
            .join(TeamMember, TeamMember.team_id == RetailerTeam.id)\
            .filter(
                and_(
                    TeamMember.user_id == user_id,
                    TeamMember.is_active == True,
                    RetailerTeam.is_active == True
                )
            )\
            .offset(skip)\
            .limit(limit)\
            .all()

    def update_team(self, team_id: int, name: str = None, description: str = None) -> Optional[RetailerTeam]:
        """Update team details"""
        team = self.get_team_by_id(team_id)
        if not team:
            return None
        
        if name is not None:
            team.name = name
        if description is not None:
            team.description = description
        
        team.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(team)
        return team

    def delete_team(self, team_id: int) -> bool:
        """Delete a team (soft delete)"""
        team = self.get_team_by_id(team_id)
        if not team:
            return False
        
        team.is_active = False
        team.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    def get_teams_count(self, owner_id: int = None) -> int:
        """Get count of teams"""
        query = self.db.query(func.count(RetailerTeam.id)).filter(RetailerTeam.is_active == True)
        if owner_id:
            query = query.filter(RetailerTeam.owner_id == owner_id)
        return query.scalar()


class TeamMemberRepository:
    """Repository for team member operations"""
    
    def __init__(self, db: Session):
        self.db = db

    def add_member(self, team_id: int, user_id: int, role: str = "viewer") -> Optional[TeamMember]:
        """Add a member to a team"""
        # Check if member already exists
        existing = self.get_member(team_id, user_id)
        if existing:
            return existing
        
        member = TeamMember(
            team_id=team_id,
            user_id=user_id,
            role=role,
            is_active=True
        )
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member

    def get_member(self, team_id: int, user_id: int) -> Optional[TeamMember]:
        """Get a team member"""
        return self.db.query(TeamMember)\
            .filter(
                and_(
                    TeamMember.team_id == team_id,
                    TeamMember.user_id == user_id
                )
            )\
            .first()

    def get_member_by_id(self, member_id: int) -> Optional[TeamMember]:
        """Get team member by ID"""
        return self.db.query(TeamMember).filter(TeamMember.id == member_id).first()

    def get_team_members(self, team_id: int, skip: int = 0, limit: int = 100) -> List[TeamMember]:
        """Get all members of a team"""
        return self.db.query(TeamMember)\
            .filter(TeamMember.team_id == team_id, TeamMember.is_active == True)\
            .offset(skip)\
            .limit(limit)\
            .all()

    def update_member_role(self, team_id: int, user_id: int, role: str) -> Optional[TeamMember]:
        """Update a member's role"""
        member = self.get_member(team_id, user_id)
        if not member:
            return None
        
        member.role = role
        member.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(member)
        return member

    def remove_member(self, team_id: int, user_id: int) -> bool:
        """Remove a member from a team (soft delete)"""
        member = self.get_member(team_id, user_id)
        if not member:
            return False
        
        member.is_active = False
        member.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    def get_team_members_count(self, team_id: int) -> int:
        """Get count of active members in a team"""
        return self.db.query(func.count(TeamMember.id))\
            .filter(TeamMember.team_id == team_id, TeamMember.is_active == True)\
            .scalar()

    def get_user_role_in_team(self, team_id: int, user_id: int) -> Optional[str]:
        """Get user's role in a team"""
        member = self.get_member(team_id, user_id)
        return member.role if member else None


class TeamInvitationRepository:
    """Repository for team invitation operations"""
    
    def __init__(self, db: Session):
        self.db = db

    def create_invitation(self, team_id: int, email: str, role: str, 
                        invited_by_id: int, token: str, expires_at: datetime, full_name: str = None) -> TeamInvitation:
        """Create a new invitation"""
        invitation = TeamInvitation(
            team_id=team_id,
            email=email,
            full_name=full_name,
            role=role,
            invited_by_id=invited_by_id,
            token=token,
            expires_at=expires_at,
            status=InvitationStatus.PENDING
        )
        self.db.add(invitation)
        self.db.commit()
        self.db.refresh(invitation)
        return invitation

    def get_invitation_by_id(self, invitation_id: int) -> Optional[TeamInvitation]:
        """Get invitation by ID"""
        return self.db.query(TeamInvitation).filter(TeamInvitation.id == invitation_id).first()

    def get_invitation_by_token(self, token: str) -> Optional[TeamInvitation]:
        """Get invitation by token"""
        return self.db.query(TeamInvitation)\
            .filter(TeamInvitation.token == token)\
            .first()

    def get_team_invitations(self, team_id: int, status: str = None, skip: int = 0, limit: int = 100) -> List[TeamInvitation]:
        """Get invitations for a team"""
        query = self.db.query(TeamInvitation).filter(TeamInvitation.team_id == team_id)
        
        if status:
            query = query.filter(TeamInvitation.status == status)
        
        return query.offset(skip).limit(limit).all()

    def get_pending_invitations_for_email(self, email: str, team_id: int = None) -> List[TeamInvitation]:
        """Get pending invitations for an email"""
        query = self.db.query(TeamInvitation)\
            .filter(
                and_(
                    TeamInvitation.email == email.lower(),
                    TeamInvitation.status == InvitationStatus.PENDING,
                    TeamInvitation.expires_at > datetime.now(timezone.utc)
                )
            )
        
        if team_id:
            query = query.filter(TeamInvitation.team_id == team_id)
        
        return query.all()

    def accept_invitation(self, invitation_id: int, user_id: int) -> Optional[TeamInvitation]:
        """Accept an invitation"""
        invitation = self.get_invitation_by_id(invitation_id)
        if not invitation:
            return None
        
        # Check if invitation is still valid
        if invitation.status != InvitationStatus.PENDING or invitation.expires_at < datetime.now(timezone.utc):
            return None
        
        invitation.status = InvitationStatus.ACCEPTED
        invitation.accepted_by_id = user_id
        invitation.accepted_at = datetime.now(timezone.utc)
        invitation.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(invitation)
        return invitation

    def decline_invitation(self, invitation_id: int) -> Optional[TeamInvitation]:
        """Decline an invitation"""
        invitation = self.get_invitation_by_id(invitation_id)
        if not invitation:
            return None
        
        invitation.status = InvitationStatus.DECLINED
        invitation.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(invitation)
        return invitation

    def cancel_invitation(self, team_id: int, email: str) -> bool:
        """Cancel pending invitation"""
        invitation = self.db.query(TeamInvitation)\
            .filter(
                and_(
                    TeamInvitation.team_id == team_id,
                    TeamInvitation.email == email.lower(),
                    TeamInvitation.status == InvitationStatus.PENDING
                )
            )\
            .first()
        
        if not invitation:
            return False
        
        invitation.status = InvitationStatus.EXPIRED
        invitation.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    def get_invitations_count(self, team_id: int, status: str = None) -> int:
        """Get count of invitations"""
        query = self.db.query(func.count(TeamInvitation.id)).filter(TeamInvitation.team_id == team_id)
        
        if status:
            query = query.filter(TeamInvitation.status == status)
        
        return query.scalar()


class TeamRolePermissionRepository:
    """Repository for team role and permission operations"""
    
    def __init__(self, db: Session):
        self.db = db

    def create_role(self, name: str, display_name: str, description: str, permissions: list) -> TeamRolePermission:
        """Create a new role"""
        import json
        role = TeamRolePermission(
            name=name,
            display_name=display_name,
            description=description,
            permissions=json.dumps(permissions),
            is_active=True
        )
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def get_role_by_id(self, role_id: int) -> Optional[TeamRolePermission]:
        """Get role by ID"""
        return self.db.query(TeamRolePermission).filter(TeamRolePermission.id == role_id).first()

    def get_role_by_name(self, name: str) -> Optional[TeamRolePermission]:
        """Get role by name"""
        return self.db.query(TeamRolePermission)\
            .filter(TeamRolePermission.name == name, TeamRolePermission.is_active == True)\
            .first()

    def get_all_roles(self, skip: int = 0, limit: int = 100) -> List[TeamRolePermission]:
        """Get all active roles"""
        return self.db.query(TeamRolePermission)\
            .filter(TeamRolePermission.is_active == True)\
            .offset(skip)\
            .limit(limit)\
            .all()

    def update_role(self, role_id: int, display_name: str = None, description: str = None, permissions: list = None) -> Optional[TeamRolePermission]:
        """Update a role"""
        import json
        role = self.get_role_by_id(role_id)
        if not role:
            return None
        
        if display_name is not None:
            role.display_name = display_name
        if description is not None:
            role.description = description
        if permissions is not None:
            role.permissions = json.dumps(permissions)
        
        role.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(role)
        return role

    def delete_role(self, role_id: int) -> bool:
        """Delete a role (soft delete)"""
        role = self.get_role_by_id(role_id)
        if not role:
            return False
        
        role.is_active = False
        role.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return True
