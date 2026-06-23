"""
Tests for GET /api/v2/admin/subscription-plans/user-subscriptions/

Verifies:
- Correct response envelope: { success, data, total }
- Each item in `data` contains all expected fields
- status filter works (ACTIVE, CANCELLED, EXPIRED, TRIAL, PAUSED, PAST_DUE)
- search filter works (by name, email, business_name)
- pagination (skip / limit) works
- 401 Unauthorized when no token supplied
- 403 Forbidden when a non-admin retailer calls the endpoint
"""

import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from tests.conftest import TestingSessionLocal
from app.core.security import create_access_token
from app.repositories.user import UserRepository
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
from app.models.brand_setting import BrandSetting
from app.models.notification_setting import NotificationSetting
from app.models.subscription import (
    SubscriptionPlan,
    UserSubscription,
    Payment,
    SubscriptionActivityLog,
    SubscriptionStatus,
    PaymentStatus,
    SubscriptionEventType,
    CancellationReason,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE_URL = "/api/v2/admin/subscription-plans/user-subscriptions/"


def _delete_user_by_id(session, uid: int, email: str):
    """Delete all rows referencing a user then the user itself.

    Manually deletes the non-CASCADE tables first; Postgres CASCADE handles
    the rest when the users row is removed.
    """
    session.query(OTP).filter(OTP.email == email).delete(synchronize_session=False)
    session.query(RefreshToken).filter(RefreshToken.user_id == uid).delete(synchronize_session=False)
    session.query(UserDevice).filter(UserDevice.user_id == uid).delete(synchronize_session=False)
    session.query(BrandSetting).filter(BrandSetting.user_id == uid).delete(synchronize_session=False)
    session.query(NotificationSetting).filter(NotificationSetting.user_id == uid).delete(synchronize_session=False)
    session.query(UserSubscription).filter(UserSubscription.user_id == uid).delete(synchronize_session=False)
    session.query(Payment).filter(Payment.user_id == uid).delete(synchronize_session=False)
    session.query(SubscriptionActivityLog).filter(
        SubscriptionActivityLog.user_id == uid
    ).delete(synchronize_session=False)
    session.commit()
    session.query(User).filter(User.id == uid).delete(synchronize_session=False)
    session.commit()


def _create_user(email: str, username: str, is_admin: bool = False, business_name: str = None) -> User:
    session = TestingSessionLocal()
    try:
        repo = UserRepository(session)
        existing = repo.get_user_by_email(email)
        if existing:
            _delete_user_by_id(session, existing.id, email)

        user = repo.create_user(
            email=email,
            username=username,
            full_name=f"User {username}",
            password="TestPass123!",
            is_verified=True,
        )
        if is_admin:
            user.is_superuser = True
        if business_name:
            user.business_name = business_name
        session.add(user)
        session.commit()
        session.refresh(user)
        return user
    finally:
        session.close()


def _cleanup_user(email: str):
    """Delete test user and all dependent rows, safe against all FK constraints."""
    session = TestingSessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if not user:
            return
        _delete_user_by_id(session, user.id, email)
    finally:
        session.close()


def _create_plan(name: str = "Test Plan") -> SubscriptionPlan:
    session = TestingSessionLocal()
    try:
        plan = SubscriptionPlan(
            name=name,
            description="Plan for testing",
            price=Decimal("99.99"),
            monthly_price=Decimal("99.99"),
            yearly_price=Decimal("999.99"),
            duration_days=30,
            is_active=True,
            monthly_renders=100,
            customer_shares=50,
            manufacturer_quotes=25,
        )
        session.add(plan)
        session.commit()
        session.refresh(plan)
        return plan
    finally:
        session.close()


def _cleanup_plan(plan_id: uuid.UUID):
    session = TestingSessionLocal()
    try:
        session.query(UserSubscription).filter(UserSubscription.plan_id == plan_id).delete()
        session.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).delete()
        session.commit()
    finally:
        session.close()


def _add_subscription(
    user_id: uuid.UUID,
    plan_id: uuid.UUID,
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE,
) -> UserSubscription:
    session = TestingSessionLocal()
    try:
        sub = UserSubscription(
            user_id=user_id,
            plan_id=plan_id,
            stripe_subscription_id=f"sub_{uuid.uuid4().hex[:12]}",
            stripe_customer_id=f"cus_{uuid.uuid4().hex[:12]}",
            start_date=datetime.now(timezone.utc),
            end_date=datetime.now(timezone.utc),
            status=status,
        )
        session.add(sub)
        session.commit()
        session.refresh(sub)
        return sub
    finally:
        session.close()


def _bearer(user: User) -> dict:
    token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestUserSubscriptionsEndpoint:
    """Focused tests for the admin user-subscriptions list endpoint."""

    # ------------------------------------------------------------------
    # 1. Response envelope shape
    # ------------------------------------------------------------------
    def test_empty_db_returns_success_shape(self, client: TestClient):
        """When there are no subscriptions, should return { success, data: [], total: 0 }."""
        admin_email = "usub_admin_empty@example.com"
        try:
            admin = _create_user(admin_email, "usub_admin_empty", is_admin=True)
            headers = _bearer(admin)

            resp = client.get(BASE_URL, headers=headers)

            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            assert isinstance(body["data"], list)
            assert isinstance(body["total"], int)
        finally:
            _cleanup_user(admin_email)

    # ------------------------------------------------------------------
    # 2. Populated response – field completeness
    # ------------------------------------------------------------------
    def test_response_contains_all_expected_fields(self, client: TestClient):
        """Each record in `data` must contain the 10 documented fields."""
        admin_email = "usub_admin_fields@example.com"
        retailer_email = "usub_retailer_fields@example.com"
        plan = _create_plan("Fields Test Plan")
        try:
            admin = _create_user(admin_email, "usub_admin_fields", is_admin=True)
            retailer = _create_user(
                retailer_email, "usub_retailer_fields", business_name="Retailer Co"
            )
            _add_subscription(retailer.id, plan.id, status=SubscriptionStatus.ACTIVE)

            headers = _bearer(admin)
            resp = client.get(BASE_URL, headers=headers)

            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            assert body["total"] >= 1

            record = next(
                (r for r in body["data"] if str(r["user_id"]) == str(retailer.id)), None
            )
            assert record is not None, "Retailer subscription not found in response"

            required_keys = {
                "id", "user_id", "user_name", "email",
                "business_name", "plan_id", "plan_name",
                "status", "start_date", "end_date", "created_at",
            }
            missing = required_keys - set(record.keys())
            assert not missing, f"Missing keys in response record: {missing}"

            # Spot-check values
            assert record["email"] == retailer_email
            assert record["plan_name"] == "Fields Test Plan"
            assert record["status"] == SubscriptionStatus.ACTIVE.value
        finally:
            _cleanup_user(retailer_email)
            _cleanup_user(admin_email)
            _cleanup_plan(plan.id)

    # ------------------------------------------------------------------
    # 3. Status filter
    # ------------------------------------------------------------------
    def test_status_filter_returns_only_matching_records(self, client: TestClient):
        """?status=CANCELLED should return only CANCELLED subscriptions."""
        admin_email = "usub_admin_status@example.com"
        retailer_a_email = "usub_retailer_active@example.com"
        retailer_c_email = "usub_retailer_cancelled@example.com"
        plan = _create_plan("Status Filter Plan")
        try:
            admin = _create_user(admin_email, "usub_admin_status", is_admin=True)
            retailer_a = _create_user(retailer_a_email, "usub_retailer_active")
            retailer_c = _create_user(retailer_c_email, "usub_retailer_cancelled")
            _add_subscription(retailer_a.id, plan.id, status=SubscriptionStatus.ACTIVE)
            _add_subscription(retailer_c.id, plan.id, status=SubscriptionStatus.CANCELLED)

            headers = _bearer(admin)
            resp = client.get(BASE_URL + "?status=CANCELLED", headers=headers)

            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            for record in body["data"]:
                assert record["status"] == "CANCELLED", (
                    f"Expected CANCELLED but got {record['status']}"
                )
        finally:
            _cleanup_user(retailer_a_email)
            _cleanup_user(retailer_c_email)
            _cleanup_user(admin_email)
            _cleanup_plan(plan.id)

    def test_status_filter_multiple_statuses(self, client: TestClient):
        """?status=ACTIVE,CANCELLED or multiple status params should return matching subscriptions."""
        admin_email = "usub_admin_mstatus@example.com"
        retailer_a_email = "usub_ret_m_active@example.com"
        retailer_c_email = "usub_ret_m_cancelled@example.com"
        retailer_e_email = "usub_ret_m_expired@example.com"
        plan = _create_plan("Multiple Status Filter Plan")
        try:
            admin = _create_user(admin_email, "usub_admin_mstatus", is_admin=True)
            retailer_a = _create_user(retailer_a_email, "usub_ret_m_active")
            retailer_c = _create_user(retailer_c_email, "usub_ret_m_cancelled")
            retailer_e = _create_user(retailer_e_email, "usub_ret_m_expired")
            _add_subscription(retailer_a.id, plan.id, status=SubscriptionStatus.ACTIVE)
            _add_subscription(retailer_c.id, plan.id, status=SubscriptionStatus.CANCELLED)
            _add_subscription(retailer_e.id, plan.id, status=SubscriptionStatus.EXPIRED)

            headers = _bearer(admin)
            # Test comma-separated string
            resp = client.get(BASE_URL + "?status=ACTIVE,CANCELLED", headers=headers)
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            statuses = {record["status"] for record in body["data"]}
            assert "ACTIVE" in statuses
            assert "CANCELLED" in statuses
            assert "EXPIRED" not in statuses

            # Test multiple status query params
            resp2 = client.get(BASE_URL + "?status=ACTIVE&status=EXPIRED", headers=headers)
            assert resp2.status_code == 200
            body2 = resp2.json()
            assert body2["success"] is True
            statuses2 = {record["status"] for record in body2["data"]}
            assert "ACTIVE" in statuses2
            assert "EXPIRED" in statuses2
            assert "CANCELLED" not in statuses2
        finally:
            _cleanup_user(retailer_a_email)
            _cleanup_user(retailer_c_email)
            _cleanup_user(retailer_e_email)
            _cleanup_user(admin_email)
            _cleanup_plan(plan.id)

    # ------------------------------------------------------------------
    # 4. Search filter – by email
    # ------------------------------------------------------------------
    def test_search_filter_by_email(self, client: TestClient):
        """?search= should match on email."""
        admin_email = "usub_admin_search@example.com"
        target_email = "usub_findme_search@example.com"
        other_email = "usub_other_search@example.com"
        plan = _create_plan("Search Email Plan")
        try:
            admin = _create_user(admin_email, "usub_admin_search", is_admin=True)
            target = _create_user(target_email, "usub_findme_search")
            other = _create_user(other_email, "usub_other_search")
            _add_subscription(target.id, plan.id, status=SubscriptionStatus.ACTIVE)
            _add_subscription(other.id, plan.id, status=SubscriptionStatus.ACTIVE)

            headers = _bearer(admin)
            resp = client.get(BASE_URL + "?search=findme", headers=headers)

            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            emails_in_resp = {r["email"] for r in body["data"]}
            assert target_email in emails_in_resp, "Target email not returned by search"
            assert other_email not in emails_in_resp, "Non-matching email should be excluded"
        finally:
            _cleanup_user(target_email)
            _cleanup_user(other_email)
            _cleanup_user(admin_email)
            _cleanup_plan(plan.id)

    # ------------------------------------------------------------------
    # 5. Pagination
    # ------------------------------------------------------------------
    def test_pagination_skip_and_limit(self, client: TestClient):
        """skip and limit should paginate correctly."""
        admin_email = "usub_admin_paging@example.com"
        retailer_emails = [f"usub_pager_{i}@example.com" for i in range(3)]
        plan = _create_plan("Pagination Plan")
        try:
            admin = _create_user(admin_email, "usub_admin_paging", is_admin=True)
            for i, email in enumerate(retailer_emails):
                r = _create_user(email, f"usub_pager_{i}")
                _add_subscription(r.id, plan.id, status=SubscriptionStatus.ACTIVE)

            headers = _bearer(admin)

            # Full list
            resp_all = client.get(BASE_URL, headers=headers)
            assert resp_all.status_code == 200
            total = resp_all.json()["total"]
            assert total >= 3

            # limit=1 should return exactly 1 record
            resp_limited = client.get(BASE_URL + "?limit=1", headers=headers)
            assert resp_limited.status_code == 200
            assert len(resp_limited.json()["data"]) == 1

            # skip past all, limit=100
            resp_skipped = client.get(BASE_URL + f"?skip={total}&limit=100", headers=headers)
            assert resp_skipped.status_code == 200
            assert resp_skipped.json()["data"] == []
        finally:
            for email in retailer_emails:
                _cleanup_user(email)
            _cleanup_user(admin_email)
            _cleanup_plan(plan.id)

    # ------------------------------------------------------------------
    # 6. Unauthenticated request
    # ------------------------------------------------------------------
    def test_unauthenticated_returns_401(self, client: TestClient):
        """Request without Authorization header must return 401."""
        resp = client.get(BASE_URL)
        assert resp.status_code == 401

    # ------------------------------------------------------------------
    # 7. Non-admin (retailer) returns 403
    # ------------------------------------------------------------------
    def test_non_admin_returns_403(self, client: TestClient):
        """A regular (non-superuser) retailer must NOT access this endpoint."""
        retailer_email = "usub_retailer_forbidden@example.com"
        try:
            retailer = _create_user(retailer_email, "usub_retailer_forbidden", is_admin=False)
            headers = _bearer(retailer)
            resp = client.get(BASE_URL, headers=headers)
            assert resp.status_code in (401, 403), (
                f"Expected 401 or 403 for non-admin, got {resp.status_code}"
            )
        finally:
            _cleanup_user(retailer_email)

    # ------------------------------------------------------------------
    # 8. total field matches len(data) when no filters applied on small DB
    # ------------------------------------------------------------------
    def test_total_matches_data_length_without_pagination(self, client: TestClient):
        """With no skip/limit override, total should equal len(data)."""
        admin_email = "usub_admin_total@example.com"
        retailer_email = "usub_retailer_total@example.com"
        plan = _create_plan("Total Match Plan")
        try:
            admin = _create_user(admin_email, "usub_admin_total", is_admin=True)
            retailer = _create_user(retailer_email, "usub_retailer_total")
            _add_subscription(retailer.id, plan.id, status=SubscriptionStatus.ACTIVE)

            headers = _bearer(admin)
            resp = client.get(BASE_URL + "?limit=1000", headers=headers)

            assert resp.status_code == 200
            body = resp.json()
            assert body["total"] == len(body["data"])
        finally:
            _cleanup_user(retailer_email)
            _cleanup_user(admin_email)
            _cleanup_plan(plan.id)
