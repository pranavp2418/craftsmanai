from pydantic import BaseModel, Field, field_validator

from app.schemas.validations import NormalizedEmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

from app.core.sanitizer import validate_and_sanitize


class TeamRoleEnum(str, Enum):
    """Team roles"""
    ADMIN = "admin"
    DESIGNER = "designer"
    SALES = "sales"
    VIEWER = "viewer"


class InvitationStatusEnum(str, Enum):
    """Invitation status"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


# ============== Team Creation/Update Schemas ==============

class TeamCreate(BaseModel):
    """Schema for creating a team"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)

    @field_validator('name', 'description')
    @classmethod
    def validate_text_fields(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize text fields to prevent XSS"""
        if v is None:
            return v
        max_len = 255 if 'name' in v else 1000
        return validate_and_sanitize(v, field_type="plain", max_length=max_len)

    class Config:
        from_attributes = True


class TeamUpdate(BaseModel):
    """Schema for updating a team"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)

    @field_validator('name', 'description')
    @classmethod
    def validate_text_fields(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize text fields to prevent XSS"""
        if v is None:
            return v
        max_len = 255 if 'name' in v else 1000
        return validate_and_sanitize(v, field_type="plain", max_length=max_len)

    class Config:
        from_attributes = True


class TeamResponse(BaseModel):
    """Schema for team response"""
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TeamDetailResponse(TeamResponse):
    """Schema for detailed team response with members"""
    members_count: int = 0
    members: Optional[List['TeamMemberResponse']] = []


# ============== Team Member Schemas ==============

class TeamMemberCreate(BaseModel):
    """Schema for adding a member to a team"""
    user_id: int
    role: TeamRoleEnum = TeamRoleEnum.VIEWER

    class Config:
        from_attributes = True


class TeamMemberUpdate(BaseModel):
    """Schema for updating a team member"""
    role: TeamRoleEnum

    class Config:
        from_attributes = True


class TeamMemberResponse(BaseModel):
    """Schema for team member response"""
    id: int
    team_id: int
    user_id: int
    role: TeamRoleEnum
    is_active: bool
    joined_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user: Optional[dict] = None  # User details

    class Config:
        from_attributes = True


class TeamMemberDetailResponse(TeamMemberResponse):
    """Schema for detailed team member response"""
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    user_username: Optional[str] = None


# ============== Team Invitation Schemas ==============

class TeamInvitationCreate(BaseModel):
    """Schema for creating a team invitation"""
    full_name: str = Field(..., min_length=1, max_length=255)
    email: NormalizedEmailStr
    role: TeamRoleEnum = TeamRoleEnum.VIEWER

    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        """Sanitize full name to prevent XSS"""
        return validate_and_sanitize(v, field_type="plain", max_length=255)

    class Config:
        from_attributes = True


class TeamInvitationResponse(BaseModel):
    """Schema for team invitation response"""
    id: int
    team_id: int
    full_name: Optional[str] = None
    email: str
    role: TeamRoleEnum
    status: InvitationStatusEnum
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TeamInvitationDetailResponse(TeamInvitationResponse):
    """Schema for detailed team invitation response"""
    team_name: Optional[str] = None
    invited_by_email: Optional[str] = None
    invited_by_full_name: Optional[str] = None
    accepted_at: Optional[datetime] = None


class InvitationAcceptRequest(BaseModel):
    """Schema for accepting a team invitation"""
    token: str


# ============== Team Role & Permission Schemas ==============

class TeamRolePermissionCreate(BaseModel):
    """Schema for creating a role with permissions"""
    name: str = Field(..., min_length=1, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: List[str] = []

    @field_validator('name', 'display_name')
    @classmethod
    def validate_text_fields(cls, v: str) -> str:
        """Sanitize text fields to prevent XSS"""
        return validate_and_sanitize(v, field_type="plain", max_length=100)
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize description to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=500)

    class Config:
        from_attributes = True


class TeamRolePermissionResponse(BaseModel):
    """Schema for role and permission response"""
    id: int
    name: str
    display_name: str
    description: Optional[str]
    permissions: List[str]
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============== Error Response Schemas ==============

class ErrorResponse(BaseModel):
    """Schema for error response"""
    status: str = "error"
    message: str
    error_code: Optional[str] = None

    class Config:
        from_attributes = True


# Update forward references
TeamDetailResponse.model_rebuild()
