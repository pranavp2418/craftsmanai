import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TeamRole(str, enum.Enum):
    admin = "admin"
    designer = "designer"
    sales = "sales"


class MemberInvitation(Base):
    __tablename__ = "member_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    account_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), nullable=False, default=TeamRole.designer.value)
    token = Column(String(255), nullable=False, unique=True, index=True)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    password = Column(String(255), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    is_accepted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    account_owner = relationship("User", foreign_keys=[account_id])
    invited_by_user = relationship("User", foreign_keys=[invited_by])

    __table_args__ = (
        UniqueConstraint("account_id", "email", name="uq_member_invitations_account_email"),
    )


class AccountMember(Base):
    __tablename__ = "account_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    account_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default=TeamRole.designer.value)
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    status = Column(String(20), nullable=False, server_default="active")
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    account_owner = relationship("User", foreign_keys=[account_id])
    user = relationship("User", foreign_keys=[user_id])
    invited_by_user = relationship("User", foreign_keys=[invited_by])

    __table_args__ = (
        UniqueConstraint("account_id", "user_id", name="uq_account_members_account_user"),
    )
