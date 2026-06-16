import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import uuid
from decimal import Decimal
from datetime import datetime, timezone

from tests.conftest import TestingSessionLocal
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
from app.models.subscription import (
    SubscriptionPlan, 
    UserSubscription, 
    Payment, 
    SubscriptionActivityLog,
    SubscriptionStatus,
    PaymentStatus,
    SubscriptionEventType,
    CancellationReason
)
from app.repositories.user import UserRepository
from app.core.security import create_access_token


def create_committed_admin(email: str, username: str) -> User:
    """Helper to create a committed superuser/admin in the real test DB"""
    from sqlalchemy import text
    session = TestingSessionLocal()
    try:
        user_repo = UserRepository(session)
        # Clean up any existing user first
        existing = user_repo.get_user_by_email(email)
        if existing:
            session.execute(text("DELETE FROM brand_settings WHERE user_id = :uid"), {"uid": existing.id})
            session.execute(text("DELETE FROM notification_settings WHERE user_id = :uid"), {"uid": existing.id})
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == existing.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == existing.id).delete()
            session.query(UserSubscription).filter(UserSubscription.user_id == existing.id).delete()
            session.query(Payment).filter(Payment.user_id == existing.id).delete()
            session.query(SubscriptionActivityLog).filter(SubscriptionActivityLog.user_id == existing.id).delete()
            session.query(User).filter(User.id == existing.id).delete()
            session.commit()
            
        user = user_repo.create_user(
            email=email,
            username=username,
            full_name="Admin User",
            password="TestPass123!",
            is_verified=True,
        )
        user.is_superuser = True
        session.add(user)
        session.commit()
        session.refresh(user)
        return user
    finally:
        session.close()


def cleanup_admin_by_email(email: str):
    """Helper to clean up the committed admin user and associated subscription structures"""
    from sqlalchemy import text
    session = TestingSessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if user:
            session.execute(text("DELETE FROM brand_settings WHERE user_id = :uid"), {"uid": user.id})
            session.execute(text("DELETE FROM notification_settings WHERE user_id = :uid"), {"uid": user.id})
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == user.id).delete()
            session.query(UserSubscription).filter(UserSubscription.user_id == user.id).delete()
            session.query(Payment).filter(Payment.user_id == user.id).delete()
            session.query(SubscriptionActivityLog).filter(SubscriptionActivityLog.user_id == user.id).delete()
            session.query(User).filter(User.id == user.id).delete()
            session.commit()
    finally:
        session.close()


class TestSubscriptionManagement:
    def test_subscription_plan_crud_and_dashboard_endpoints(self, client: TestClient):
        email = "sub_admin@example.com"
        try:
            # 1. Setup Admin Authentication
            admin = create_committed_admin(email=email, username="subadmin")
            token = create_access_token(data={"sub": str(admin.id), "email": admin.email})
            headers = {"Authorization": f"Bearer {token}"}

            plan_payload = {
                "name": "Test Enterprise Plan",
                "description": "Premium features for large shops",
                "price": 499.99,
                "monthly_price": 499.99,
                "duration_days": 30,
                "is_active": True,
                "is_most_popular": True,
                "feature_points": ["Custom Watermark", "Dedicated Agent", "Fastest AI Speed"],
                "monthly_renders": 5000
            }
            
            res_create = client.post("/api/v2/admin/subscription-plans/", json=plan_payload, headers=headers)
            assert res_create.status_code == 201
            plan_data = res_create.json()
            plan_id = plan_data["id"]
            assert plan_data["name"] == "Test Enterprise Plan"
            assert plan_data["monthly_renders"] == 5000

            # 3. Test GET /admin/subscription-plans/ (List plans)
            res_list = client.get("/api/v2/admin/subscription-plans/", headers=headers)
            assert res_list.status_code == 200
            plans_list = res_list.json()
            assert len(plans_list) >= 1
            assert any(p["id"] == plan_id for p in plans_list)

            # 4. Test GET /admin/subscription-plans/{plan_id} (Get single plan)
            res_get = client.get(f"/api/v2/admin/subscription-plans/{plan_id}", headers=headers)
            assert res_get.status_code == 200
            assert res_get.json()["id"] == plan_id

            # 5. Test PUT /admin/subscription-plans/{plan_id} (Update plan)
            update_payload = {
                "name": "Updated Test Enterprise Plan",
                "monthly_renders": 10000
            }
            res_update = client.put(f"/api/v2/admin/subscription-plans/{plan_id}", json=update_payload, headers=headers)
            assert res_update.status_code == 200
            assert res_update.json()["name"] == "Updated Test Enterprise Plan"
            assert res_update.json()["monthly_renders"] == 10000

            # 6. Add manual records using TestingSessionLocal for testing analytic/logs/payment endpoints
            session = TestingSessionLocal()
            try:
                # Add a dummy cancelled user subscription
                sub = UserSubscription(
                    user_id=admin.id,
                    plan_id=uuid.UUID(plan_id),
                    stripe_subscription_id="sub_test_12345",
                    stripe_customer_id="cus_test_12345",
                    start_date=datetime.now(timezone.utc),
                    end_date=datetime.now(timezone.utc),
                    status=SubscriptionStatus.CANCELLED,
                    cancellation_reason=CancellationReason.TOO_EXPENSIVE
                )
                session.add(sub)
                
                # Add a payment record
                payment = Payment(
                    invoice_id="inv_test_12345",
                    user_id=admin.id,
                    plan_id=uuid.UUID(plan_id),
                    amount=Decimal("499.99"),
                    status=PaymentStatus.PAID,
                    payment_method="card"
                )
                session.add(payment)
                
                # Add an activity log
                log = SubscriptionActivityLog(
                    user_id=admin.id,
                    event_type=SubscriptionEventType.CREATED,
                    plan_name="Test Enterprise Plan",
                    triggered_by="Admin",
                    triggered_by_id=admin.id
                )
                session.add(log)
                session.commit()
                
                payment_id = str(payment.id)
                
            finally:
                session.close()

            # 7. Test Dashboard Stats endpoint
            res_stats = client.get("/api/v2/admin/subscription-plans/overview/stats", headers=headers)
            assert res_stats.status_code == 200
            stats = res_stats.json()
            assert "mrr" in stats
            assert "active_subscriptions" in stats
            assert "churn_rate" in stats

            # 8. Test Revenue Growth Chart endpoint
            res_rev = client.get("/api/v2/admin/subscription-plans/overview/revenue-growth", headers=headers)
            assert res_rev.status_code == 200
            assert isinstance(res_rev.json(), list)

            # 9. Test Subscription Growth Chart endpoint
            res_growth = client.get("/api/v2/admin/subscription-plans/overview/subscription-growth", headers=headers)
            assert res_growth.status_code == 200
            assert isinstance(res_growth.json(), list)

            # 10. Test Plan Distribution endpoint
            res_dist = client.get("/api/v2/admin/subscription-plans/overview/plan-distribution", headers=headers)
            assert res_dist.status_code == 200
            assert isinstance(res_dist.json(), list)

            # 11. Test Cancellation Summary endpoint
            res_canc_sum = client.get("/api/v2/admin/subscription-plans/cancellation-insights/summary", headers=headers)
            assert res_canc_sum.status_code == 200
            assert res_canc_sum.json()["success"] is True

            # 12. Test Cancellation Reasons endpoint
            res_reasons = client.get("/api/v2/admin/subscription-plans/cancellation-insights/reasons", headers=headers)
            assert res_reasons.status_code == 200
            assert res_reasons.json()["success"] is True

            # 13. Test Cancellation Trends endpoint
            res_trends = client.get("/api/v2/admin/subscription-plans/cancellation-insights/trends", headers=headers)
            assert res_trends.status_code == 200
            assert res_trends.json()["success"] is True

            # 14. Test Payment History list endpoint
            res_payments = client.get("/api/v2/admin/subscription-plans/payment-history/", headers=headers)
            assert res_payments.status_code == 200
            assert res_payments.json()["success"] is True
            assert len(res_payments.json()["data"]) >= 1

            # 15. Test Payment History export endpoint
            res_payments_exp = client.get("/api/v2/admin/subscription-plans/payment-history/export", headers=headers)
            assert res_payments_exp.status_code == 200
            assert "text/csv" in res_payments_exp.headers["content-type"]

            # 16. Test Payment History single detail endpoint
            res_pay_detail = client.get(f"/api/v2/admin/subscription-plans/payment-history/{payment_id}", headers=headers)
            assert res_pay_detail.status_code == 200
            assert res_pay_detail.json()["success"] is True
            assert res_pay_detail.json()["data"]["invoice_id"] == "inv_test_12345"

            # 17. Test Payment History download CSV endpoint
            res_pay_dl = client.get(f"/api/v2/admin/subscription-plans/payment-history/{payment_id}/download", headers=headers)
            assert res_pay_dl.status_code == 200
            assert "text/csv" in res_pay_dl.headers["content-type"]

            # 18. Test Subscription Activity Logs list endpoint
            res_logs = client.get("/api/v2/admin/subscription-plans/activity-logs/", headers=headers)
            assert res_logs.status_code == 200
            assert res_logs.json()["success"] is True
            assert len(res_logs.json()["data"]) >= 1

            # 19. Test Subscription Activity Logs export CSV endpoint
            res_logs_exp = client.get("/api/v2/admin/subscription-plans/activity-logs/export", headers=headers)
            assert res_logs_exp.status_code == 200
            assert "text/csv" in res_logs_exp.headers["content-type"]

            # 20. Test Retailer User Subscriptions endpoint
            res_user_subs = client.get("/api/v2/admin/subscription-plans/user-subscriptions/", headers=headers)
            assert res_user_subs.status_code == 200
            assert res_user_subs.json()["success"] is True
            assert len(res_user_subs.json()["data"]) >= 1

            # 21. Test Get User Detail endpoint (Admin only)
            from unittest.mock import patch, MagicMock
            mock_pm = MagicMock()
            mock_pm.card.brand = "visa"
            mock_pm.card.last4 = "4242"
            mock_pm.card.exp_month = 12
            mock_pm.card.exp_year = 2030
            
            mock_list = MagicMock(data=[mock_pm])
            
            with patch("stripe.PaymentMethod.list", return_value=mock_list):
                res_detail = client.get(f"/api/v2/admin/subscription-plans/get-user-detail?user_id={admin.id}", headers=headers)
                assert res_detail.status_code == 200
                detail_data = res_detail.json()
                assert detail_data["plan_name"] == "Updated Test Enterprise Plan"
                assert detail_data["payment_method"]["brand"] == "visa"
                assert detail_data["payment_method"]["last4"] == "4242"

        finally:
            cleanup_admin_by_email(email)
            # Remove subscription plan from database so we don't pollute subsequent test runs
            session = TestingSessionLocal()
            try:
                session.query(UserSubscription).filter(UserSubscription.user_id == admin.id).delete()
                session.query(Payment).filter(Payment.user_id == admin.id).delete()
                session.query(SubscriptionActivityLog).filter(SubscriptionActivityLog.user_id == admin.id).delete()
                session.query(SubscriptionPlan).delete()
                session.commit()
            finally:
                session.close()
