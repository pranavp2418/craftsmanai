from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.validations import NormalizedEmailStr


class TeamRoleEnum(str, Enum):
    admin = "admin"
    designer = "designer"
    sales = "sales"


class MemberInvitationCreate(BaseModel):
    email: NormalizedEmailStr
    role: TeamRoleEnum = TeamRoleEnum.designer
    full_name: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = Field(None, min_length=8, max_length=255, description="Optional password for new users. If not provided, a default password will be generated.")


class AcceptInvitationRequest(BaseModel):
    token: str
    password: Optional[str] = Field(None, min_length=8, max_length=255, description="Password to set for new users upon accepting the invitation")
    full_name: Optional[str] = Field(None, max_length=255, description="Full name to set for the new user")


class MemberUpdateRequest(BaseModel):
    role: Optional[TeamRoleEnum] = None


class MemberSummary(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class MemberInvitationResponse(BaseModel):
    id: UUID
    account_id: int
    email: str
    role: TeamRoleEnum
    invited_by: Optional[int] = None
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    is_accepted: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class InvitationTokenResponse(BaseModel):
    token: str


class AccountMemberResponse(BaseModel):
    id: UUID
    account_id: int
    user_id: int
    role: TeamRoleEnum
    invited_by: Optional[int] = None
    joined_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    status: str
    deleted_at: Optional[datetime] = None
    user: Optional[MemberSummary] = None

    class Config:
        from_attributes = True


class PaginationMetadata(BaseModel):
    page: int
    limit: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool


class TeamMembersListResponse(BaseModel):
    account_id: int
    members_count: int
    members: list[AccountMemberResponse]
    pagination: Optional[PaginationMetadata] = None
