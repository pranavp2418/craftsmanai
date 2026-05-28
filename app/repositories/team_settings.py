from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.team_settings import AccountMember, MemberInvitation, TeamRole


class MemberInvitationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_token(self, token: str) -> Optional[MemberInvitation]:
        return self.db.query(MemberInvitation).filter(MemberInvitation.token == token).first()

    def get_active_pending_by_account_and_email(self, account_id: Optional[int], email: str) -> Optional[MemberInvitation]:
        now = datetime.now(timezone.utc)
        filters = [
            func.lower(MemberInvitation.email) == email.lower(),
            MemberInvitation.is_accepted.is_(False),
            MemberInvitation.expires_at > now,
        ]
        if account_id is not None:
            filters.append(MemberInvitation.account_id == account_id)

        return self.db.query(MemberInvitation).filter(and_(*filters)).first()

    def create(self, invitation: MemberInvitation) -> MemberInvitation:
        self.db.add(invitation)
        self.db.commit()
        self.db.refresh(invitation)
        return invitation

    def mark_accepted(self, invitation: MemberInvitation) -> MemberInvitation:
        invitation.is_accepted = True
        invitation.accepted_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(invitation)
        return invitation

    def list_by_account(self, account_id: int) -> List[MemberInvitation]:
        return (
            self.db.query(MemberInvitation)
            .filter(MemberInvitation.account_id == account_id)
            .order_by(MemberInvitation.created_at.desc())
            .all()
        )


class AccountMemberRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_account_and_user(self, account_id: int, user_id: int) -> Optional[AccountMember]:
        return (
            self.db.query(AccountMember)
            .filter(
                and_(
                    AccountMember.account_id == account_id,
                    AccountMember.user_id == user_id,
                )
            )
            .first()
        )

    def get_active_by_account_and_user(self, account_id: int, user_id: int) -> Optional[AccountMember]:
        return (
            self.db.query(AccountMember)
            .filter(
                and_(
                    AccountMember.account_id == account_id,
                    AccountMember.user_id == user_id,
                    AccountMember.status == "active",
                    AccountMember.deleted_at.is_(None),
                )
            )
            .first()
        )

    def list_by_account(self, account_id: int, skip: Optional[int] = None, limit: Optional[int] = None) -> List[AccountMember]:
        query = (
            self.db.query(AccountMember)
            .filter(
                and_(
                    AccountMember.account_id == account_id,
                    AccountMember.status == "active",
                    AccountMember.deleted_at.is_(None),
                )
            )
            .order_by(AccountMember.created_at.asc())
        )
        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def count_by_account(self, account_id: int) -> int:
        return (
            self.db.query(func.count(AccountMember.id))
            .filter(
                and_(
                    AccountMember.account_id == account_id,
                    AccountMember.status == "active",
                    AccountMember.deleted_at.is_(None),
                )
            )
            .scalar()
        ) or 0

    def count_active_admins(self, account_id: int) -> int:
        return (
            self.db.query(func.count(AccountMember.id))
            .filter(
                and_(
                    AccountMember.account_id == account_id,
                    AccountMember.status == "active",
                    AccountMember.deleted_at.is_(None),
                    AccountMember.role == TeamRole.admin.value,
                )
            )
            .scalar()
        )

    def upsert_member(
        self,
        account_id: int,
        user_id: int,
        role: str,
        invited_by: Optional[int] = None,
    ) -> AccountMember:
        member = self.get_by_account_and_user(account_id, user_id)
        if member:
            member.role = role
            member.invited_by = invited_by
            member.status = "active"
            member.deleted_at = None
            member.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(member)
            return member

        member = AccountMember(
            account_id=account_id,
            user_id=user_id,
            role=role,
            invited_by=invited_by,
            status="active",
        )
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member

    def update_role(self, account_id: int, user_id: int, role: str) -> Optional[AccountMember]:
        member = self.get_active_by_account_and_user(account_id, user_id)
        if not member:
            return None

        member.role = role
        member.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(member)
        return member

    def soft_delete(self, account_id: int, user_id: int) -> Optional[AccountMember]:
        member = self.get_active_by_account_and_user(account_id, user_id)
        if not member:
            return None

        member.status = "deleted"
        member.deleted_at = datetime.now(timezone.utc)
        member.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(member)
        return member
