from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class TeamRole(str, enum.Enum):
    """Available roles in a team"""
    ADMIN = "admin"
    DESIGNER = "designer"
    SALES = "sales"
    VIEWER = "viewer"


class InvitationStatus(str, enum.Enum):
    """Status of team invitation"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class RetailerTeam(Base):
    """Retailer team model for managing teams"""
    __tablename__ = "retailer_teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    invitations = relationship("TeamInvitation", back_populates="team", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<RetailerTeam(id={self.id}, name={self.name}, owner_id={self.owner_id})>"


class TeamMember(Base):
    """Team member model"""
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("retailer_teams.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(SQLEnum(TeamRole), default=TeamRole.VIEWER)
    
    # Status
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    team = relationship("RetailerTeam", back_populates="members")
    user = relationship("User")
    
    __table_args__ = (
        # Ensure each user can only join a team once
        __import__('sqlalchemy').UniqueConstraint('team_id', 'user_id', name='uq_team_member'),
    )
    
    def __repr__(self):
        return f"<TeamMember(id={self.id}, team_id={self.team_id}, user_id={self.user_id}, role={self.role})>"


class TeamInvitation(Base):
    """Team invitation model for email invitations"""
    __tablename__ = "team_invitations"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("retailer_teams.id"), nullable=False)
    invited_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    email = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(SQLEnum(TeamRole), default=TeamRole.VIEWER)
    
    # Invitation status
    status = Column(SQLEnum(InvitationStatus), default=InvitationStatus.PENDING)
    
    # Invitation token
    token = Column(String(255), unique=True, index=True)
    
    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    team = relationship("RetailerTeam", back_populates="invitations")
    invited_by = relationship("User", foreign_keys=[invited_by_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_id])
    
    def __repr__(self):
        return f"<TeamInvitation(id={self.id}, team_id={self.team_id}, email={self.email}, status={self.status})>"


class TeamRolePermission(Base):
    """Team role and permissions model"""
    __tablename__ = "team_role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Permissions (stored as JSON string for flexibility)
    permissions = Column(Text, nullable=False, default='[]')
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<TeamRolePermission(id={self.id}, name={self.name})>"
