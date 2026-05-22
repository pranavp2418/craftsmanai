import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from tests.conftest import TestingSessionLocal
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
from app.models.subscription import (
    SubscriptionPlan, 
    UserSubscription, 
    Payment, 
    SubscriptionStatus,
    PaymentStatus
)
from app.models.design import Design, DesignVariant, DesignShare
from app.repositories.user import UserRepository
from app.core.security import create_access_token


def create_committed_user(email: str, username: str) -> User:
    """Helper to create a committed retailer in the test DB"""
    session = TestingSessionLocal()
    try:
        user_repo = UserRepository(session)
        existing = user_repo.get_user_by_email(email)
        if existing:
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == existing.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == existing.id).delete()
            session.query(UserSubscription).filter(UserSubscription.user_id == existing.id).delete()
            session.query(Payment).filter(Payment.user_id == existing.id).delete()
            session.query(DesignShare).delete()
            session.query(DesignVariant).delete()
            session.query(Design).filter(Design.user_id == existing.id).delete()
            session.query(User).filter(User.id == existing.id).delete()
            session.commit()
            
        user = user_repo.create_user(
            email=email,
            username=username,
            full_name="Retailer User",
            password="TestPass123!",
            is_verified=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user
    finally:
        session.close()


def cleanup_user_by_email(email: str):
    """Helper to clean up the committed user and associated subscription structures"""
    session = TestingSessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if user:
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == user.id).delete()
            session.query(UserSubscription).filter(UserSubscription.user_id == user.id).delete()
            session.query(Payment).filter(Payment.user_id == user.id).delete()
            session.query(DesignShare).delete()
            session.query(DesignVariant).delete()
            session.query(Design).filter(Design.user_id == user.id).delete()
            session.query(User).filter(User.id == user.id).delete()
            session.commit()
    finally:
        session.close()


class TestRetailerSubscription:
    @patch("stripe.checkout.Session.create")
    @patch("stripe.checkout.Session.retrieve")
    @patch("stripe.Customer.retrieve")
    @patch("stripe.PaymentMethod.list")
    @patch("stripe.PaymentMethod.retrieve")
    @patch("stripe.PaymentMethod.attach")
    @patch("stripe.Customer.modify")
    @patch("stripe.PaymentMethod.detach")
    @patch("stripe.Customer.create")
    def test_retailer_subscription_flows(
        self,
        mock_cust_create,
        mock_detach,
        mock_modify,
        mock_attach,
        mock_pm_retrieve,
        mock_pm_list,
        mock_cust_retrieve,
        mock_checkout_retrieve,
        mock_checkout_create,
        client: TestClient
    ):
        email = "retailer_test@example.com"
        
        # 1. Setup mocks
        mock_cust_create.return_value = MagicMock(id="cus_test_retailer")
        mock_checkout_create.return_value = MagicMock(id="sess_checkout_123", url="https://stripe.example.com/checkout")
        mock_session_obj = MagicMock()
        mock_session_obj.payment_status = "paid"
        mock_session_obj.payment_intent = "pi_123"
        mock_session_obj.get.return_value = "sub_stripe_123"
        mock_checkout_retrieve.return_value = mock_session_obj
        
        mock_cust = MagicMock()
        mock_cust.invoice_settings = {"default_payment_method": "pm_123"}
        mock_cust.id = "cus_test_retailer"
        mock_cust.email = email
        mock_cust.name = "Retailer User"
        mock_cust.description = "Test description"
        mock_cust.created = 123456789
        mock_cust.metadata = {}
        mock_cust_retrieve.return_value = mock_cust
        
        mock_pm = MagicMock()
        mock_pm.id = "pm_123"
        mock_pm.card.brand = "visa"
        mock_pm.card.last4 = "4242"
        mock_pm.card.exp_month = 12
        mock_pm.card.exp_year = 2030
        mock_pm.type = "card"
        mock_pm.customer = "cus_test_retailer"
        
        mock_pm_list.return_value = MagicMock(data=[mock_pm])
        mock_pm_retrieve.return_value = mock_pm

        try:
            # 2. Create User and Token
            user = create_committed_user(email=email, username="retailer_t")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # 3. Create Subscription Plan in DB for testing
            session = TestingSessionLocal()
            plan = SubscriptionPlan(
                name="Business",
                description="Business tier",
                price=Decimal("299.99"),
                monthly_price=Decimal("299.99"),
                yearly_price=Decimal("2999.99"),
                duration_days=30,
                is_active=True,
                feature_points=["Watermark Removal"],
                monthly_renders=1000,
                customer_shares=100,
                manufacturer_quotes=100
            )
            session.add(plan)
            session.commit()
            session.refresh(plan)
            plan_id = str(plan.id)
            session.close()

            # 4. Test GET /api/v2/retailer/subscriptions/ (List Plans)
            res_plans = client.get("/api/v2/retailer/subscriptions/", headers=headers)
            assert res_plans.status_code == 200
            assert len(res_plans.json()) >= 1

            # 5. Test POST /api/v2/retailer/subscriptions/create-checkout-session
            checkout_payload = {"plan_id": plan_id, "billing_cycle": "monthly"}
            res_checkout = client.post(
                f"/api/v2/retailer/subscriptions/create-checkout-session?plan_id={plan_id}&billing_cycle=monthly", 
                headers=headers
            )
            assert res_checkout.status_code == 200
            assert "checkout_url" in res_checkout.json()

            # Find the generated payment record
            session = TestingSessionLocal()
            payment = session.query(Payment).filter(Payment.user_id == user.id).first()
            assert payment is not None
            payment_id = str(payment.id)
            session.close()

            # 6. Test GET /api/v2/retailer/subscriptions/verify-payment/{session_id}
            res_verify = client.get(
                f"/api/v2/retailer/subscriptions/verify-payment/sess_checkout_123",
                headers=headers
            )
            assert res_verify.status_code == 200
            assert res_verify.json()["status"] == "success"

            # Check that user's plan is updated to Business and limits are refreshed
            session = TestingSessionLocal()
            updated_user = session.query(User).filter(User.id == user.id).first()
            assert updated_user.subscription_plan == "Business"
            user_sub = session.query(UserSubscription).filter(
                UserSubscription.user_id == user.id,
                UserSubscription.status == SubscriptionStatus.ACTIVE
            ).first()
            assert user_sub is not None
            assert user_sub.initial_monthly_renders == 1000
            session.close()

            # 7. Test GET /api/v2/retailer/subscriptions/subscription-dashboard
            res_dash = client.get("/api/v2/retailer/subscriptions/subscription-dashboard", headers=headers)
            assert res_dash.status_code == 200
            dash_data = res_dash.json()["data"]
            assert dash_data["currentSubscription"]["planName"] == "Business"
            assert dash_data["usageMetrics"]["requestsLimit"] == 1000

            # 8. Add design usage records for breakdown check
            session = TestingSessionLocal()
            design = Design(
                user_id=user.id,
                design_code="DES-001",
                sequence_number=1,
                name="Gold Ring",
                status="GENERATED"
            )
            session.add(design)
            session.commit()
            
            variant = DesignVariant(
                design_id=design.id,
                variant_name="Version A",
                version_number=1,
                is_selected=True
            )
            session.add(variant)
            
            share = DesignShare(
                design_id=design.id,
                public_token="token_abc_123",
                status="PENDING"
            )
            session.add(share)
            session.commit()
            session.close()

            # 10. Test GET /api/v2/retailer/subscriptions/payment-history
            res_history = client.get("/api/v2/retailer/subscriptions/payment-history", headers=headers)
            assert res_history.status_code == 200
            assert len(res_history.json()["data"]["payments"]) >= 1

            # 11. Test GET /api/v2/retailer/subscriptions/payment/{payment_id} (PDF invoice detail)
            res_pdf = client.get(f"/api/v2/retailer/subscriptions/payment/{payment_id}", headers=headers)
            assert res_pdf.status_code == 200
            assert "application/pdf" in res_pdf.headers["content-type"]

            # 13. Test GET /api/v2/retailer/subscriptions/token-status
            res_tokens = client.get("/api/v2/retailer/subscriptions/token-status", headers=headers)
            assert res_tokens.status_code == 200
            assert res_tokens.json()["data"]["monthly_renders_limit"] == 1000

            # 19. Test GET /api/v2/retailer/subscriptions/my-plan
            res_my_plans = client.get("/api/v2/retailer/subscriptions/my-plan", headers=headers)
            assert res_my_plans.status_code == 200
            assert len(res_my_plans.json()) >= 1


            # 21. Test background reset and queue triggers
            res_reset = client.post("/api/v2/retailer/subscriptions/reset-monthly-tokens", headers=headers)
            assert res_reset.status_code == 200
            assert "reset_count" in res_reset.json()

            res_queue = client.post("/api/v2/retailer/subscriptions/activate-queued-subscriptions", headers=headers)
            assert res_queue.status_code == 200
            assert "activated_count" in res_queue.json()

        finally:
            cleanup_user_by_email(email)
            # Remove plans
            session = TestingSessionLocal()
            try:
                session.query(SubscriptionPlan).delete()
                session.commit()
            finally:
                session.close()
