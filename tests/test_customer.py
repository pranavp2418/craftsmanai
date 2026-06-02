import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import TestingSessionLocal
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
from app.models.notification_setting import NotificationSetting
from app.models.brand_setting import BrandSetting
from app.models.customer import Customer
from app.models.design import Design, DesignVariant, DesignShare
from app.models.order import Order, ManufacturerQuote, OrderActivityLog
from app.models.manufacturer import Manufacturer
from app.models.manufacturer import Manufacturer
from app.repositories.user import UserRepository
from app.core.security import create_access_token


def create_committed_user(email: str, username: str, full_name: str) -> User:
    """Helper to create a committed user in the real test DB"""
    session = TestingSessionLocal()
    try:
        user_repo = UserRepository(session)
        # Clean up any existing user first
        existing = user_repo.get_user_by_email(email)
        if existing:
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == existing.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == existing.id).delete()
            customer_ids = [row[0] for row in session.query(Customer.id).filter(Customer.created_by_user_id == existing.id).all()]
            design_ids = [row[0] for row in session.query(Design.id).filter(Design.user_id == existing.id).all()]
            variant_ids = []
            if design_ids:
                variant_ids = [row[0] for row in session.query(DesignVariant.id).filter(DesignVariant.design_id.in_(design_ids)).all()]
            if customer_ids:
                session.query(DesignShare).filter(DesignShare.customer_id.in_(customer_ids)).delete(synchronize_session=False)
            if variant_ids:
                session.query(DesignShare).filter(DesignShare.design_variant_id.in_(variant_ids)).delete(synchronize_session=False)
            if design_ids:
                order_ids = [row[0] for row in session.query(Order.id).filter(Order.design_id.in_(design_ids)).all()]
                if order_ids:
                    session.query(OrderActivityLog).filter(OrderActivityLog.order_id.in_(order_ids)).delete(synchronize_session=False)
                    session.query(ManufacturerQuote).filter(ManufacturerQuote.order_id.in_(order_ids)).delete(synchronize_session=False)
                    session.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)
                session.query(DesignVariant).filter(DesignVariant.design_id.in_(design_ids)).delete(synchronize_session=False)
                session.query(Design).filter(Design.id.in_(design_ids)).delete(synchronize_session=False)
            session.query(Customer).filter(Customer.created_by_user_id == existing.id).delete()
            session.query(Manufacturer).filter(Manufacturer.created_by_user_id == existing.id).delete()
            session.query(NotificationSetting).filter(NotificationSetting.user_id == existing.id).delete()
            session.query(BrandSetting).filter(BrandSetting.user_id == existing.id).delete()
            session.delete(existing)
            session.commit()
            
        user = user_repo.create_user(
            email=email,
            username=username,
            full_name=full_name,
            password="TestPass123!",
            is_verified=True,
        )
        session.commit()
        session.refresh(user)
        return user
    finally:
        session.close()


def cleanup_user_by_email(email: str):
    """Helper to clean up the committed user and associated customers"""
    session = TestingSessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if user:
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == user.id).delete()
            customer_ids = [row[0] for row in session.query(Customer.id).filter(Customer.created_by_user_id == user.id).all()]
            design_ids = [row[0] for row in session.query(Design.id).filter(Design.user_id == user.id).all()]
            variant_ids = []
            if design_ids:
                variant_ids = [row[0] for row in session.query(DesignVariant.id).filter(DesignVariant.design_id.in_(design_ids)).all()]
            if customer_ids:
                session.query(DesignShare).filter(DesignShare.customer_id.in_(customer_ids)).delete(synchronize_session=False)
            if variant_ids:
                session.query(DesignShare).filter(DesignShare.design_variant_id.in_(variant_ids)).delete(synchronize_session=False)
            if design_ids:
                order_ids = [row[0] for row in session.query(Order.id).filter(Order.design_id.in_(design_ids)).all()]
                if order_ids:
                    session.query(OrderActivityLog).filter(OrderActivityLog.order_id.in_(order_ids)).delete(synchronize_session=False)
                    session.query(ManufacturerQuote).filter(ManufacturerQuote.order_id.in_(order_ids)).delete(synchronize_session=False)
                    session.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)
                session.query(DesignVariant).filter(DesignVariant.design_id.in_(design_ids)).delete(synchronize_session=False)
                session.query(Design).filter(Design.id.in_(design_ids)).delete(synchronize_session=False)
            session.query(Customer).filter(Customer.created_by_user_id == user.id).delete()
            session.query(Manufacturer).filter(Manufacturer.created_by_user_id == user.id).delete()
            session.query(NotificationSetting).filter(NotificationSetting.user_id == user.id).delete()
            session.query(BrandSetting).filter(BrandSetting.user_id == user.id).delete()
            session.delete(user)
            session.commit()
    finally:
        session.close()


class TestCustomerEndpoints:
    """Test Suite for Customer Management API Endpoints aligned with UI specification"""

    def test_create_customer_with_ui_payload(self, client: TestClient):
        """Test creating a customer using the exact new UI fields"""
        email = "customer_test@example.com"
        try:
            user = create_committed_user(email=email, username="custtest", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "full_name": "VIP Client Jane",
                "tag": "VIP Customer",
                "emails": [
                    {"label": "Work", "email": "work_jane@vip.com"},
                    {"label": "Home", "email": "home_jane@gmail.com"}
                ],
                "phone_number": "+1555123456",
                "location": "Beverly Hills, CA",
                "status": "Active"
            }

            response = client.post("/api/v2/customer/", json=payload, headers=headers)
            assert response.status_code == 201

            data = response.json()
            assert data["full_name"] == "VIP Client Jane"
            assert data["tag"] == "VIP Customer"
            assert len(data["emails"]) == 2
            assert data["emails"][0]["email"] == "work_jane@vip.com"
            assert data["emails"][1]["email"] == "home_jane@gmail.com"
            assert data["phone_number"] == "+1555123456"
            assert data["location"] == "Beverly Hills, CA"
            assert data["status"] == "Active"
            assert "public_token" in data
        finally:
            cleanup_user_by_email(email)

    def test_create_customer_rejects_duplicate_email(self, client: TestClient):
        email = "customer_duplicate_email@example.com"
        try:
            user = create_committed_user(email=email, username="custdupemail", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            first_payload = {
                "full_name": "Existing Customer",
                "emails": [{"label": "Work", "email": "shared@example.com"}],
                "phone_number": "+15550001",
                "status": "Active",
            }
            second_payload = {
                "full_name": "Duplicate Email Customer",
                "emails": [{"label": "Work", "email": "shared@example.com"}],
                "phone_number": "+15550002",
                "status": "Active",
            }

            res_first = client.post("/api/v2/customer/", json=first_payload, headers=headers)
            assert res_first.status_code == 201

            res_second = client.post("/api/v2/customer/", json=second_payload, headers=headers)
            assert res_second.status_code == 409
            assert "email" in res_second.json()["detail"].lower()
        finally:
            cleanup_user_by_email(email)

    def test_create_customer_rejects_duplicate_phone(self, client: TestClient):
        email = "customer_duplicate_phone@example.com"
        try:
            user = create_committed_user(email=email, username="custdupphone", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            first_payload = {
                "full_name": "Existing Customer",
                "emails": [{"label": "Work", "email": "first@example.com"}],
                "phone_number": "+15559991",
                "status": "Active",
            }
            second_payload = {
                "full_name": "Duplicate Phone Customer",
                "emails": [{"label": "Work", "email": "second@example.com"}],
                "phone_number": "+15559991",
                "status": "Active",
            }

            res_first = client.post("/api/v2/customer/", json=first_payload, headers=headers)
            assert res_first.status_code == 201

            res_second = client.post("/api/v2/customer/", json=second_payload, headers=headers)
            assert res_second.status_code == 409
            assert "phone" in res_second.json()["detail"].lower()
        finally:
            cleanup_user_by_email(email)

    def test_create_customer_rejects_duplicate_manufacturer_contact(self, client: TestClient):
        email = "customer_manufacturer_cross_dup@example.com"
        try:
            user = create_committed_user(email=email, username="custcrossdup", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            session = TestingSessionLocal()
            manufacturer = Manufacturer(
                created_by_user_id=user.id,
                name="Existing Maker",
                speciality="Gold Specialist",
                emails='[{"label":"Work","email":"shared-cross@example.com"}]',
                phone_number="+6001",
                location="Rome",
                public_token="cross_manufacturer_token",
                is_active=True,
            )
            try:
                session.add(manufacturer)
                session.commit()
            finally:
                session.close()

            payload = {
                "full_name": "Cross Duplicate Customer",
                "emails": [{"label": "Work", "email": "shared-cross@example.com"}],
                "phone_number": "+7001",
                "status": "Active",
            }

            response = client.post("/api/v2/customer/", json=payload, headers=headers)
            assert response.status_code == 409
            assert response.json()["detail"] == "Customer with same email already exists"
        finally:
            cleanup_user_by_email(email)

    def test_get_customer_legacy_support(self, client: TestClient):
        """Test that legacy database rows are formatted properly for UI fields"""
        email = "customer_legacy@example.com"
        try:
            user = create_committed_user(email=email, username="custlegacy", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # Create a customer with standard legacy fields directly in the database
            session = TestingSessionLocal()
            customer_valid_tag = Customer(
                created_by_user_id=user.id,
                full_name="Legacy Client 1",
                emails="legacy1@domain.com",
                phone_number="123456",
                tag="VIP Customer",  # Valid Enum
                location="123 Old St",
                public_token="token_abc_123",
                is_active=False
            )
            customer_invalid_tag = Customer(
                created_by_user_id=user.id,
                full_name="Legacy Client 2",
                emails="legacy2@domain.com",
                phone_number="789012",
                tag="Old Corp",  # Invalid legacy text
                location="456 New St",
                public_token="token_xyz_789",
                is_active=True
            )
            session.add(customer_valid_tag)
            session.add(customer_invalid_tag)
            session.commit()
            id_valid = customer_valid_tag.id
            id_invalid = customer_invalid_tag.id
            session.close()

            # 1. GET valid legacy customer
            response = client.get(f"/api/v2/customer/{id_valid}", headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data["full_name"] == "Legacy Client 1"
            assert data["tag"] == "VIP Customer"
            assert data["status"] == "Inactive"

            # 2. GET invalid legacy customer (must map tag to None gracefully)
            response = client.get(f"/api/v2/customer/{id_invalid}", headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data["full_name"] == "Legacy Client 2"
            assert data["tag"] is None  # Gracefully mapped to None
            assert data["status"] == "Active"
        finally:
            cleanup_user_by_email(email)

    def test_get_customer_parses_legacy_email_list_string(self, client: TestClient):
        email = "customer_legacy_emails@example.com"
        try:
            user = create_committed_user(email=email, username="custlegacyemails", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            session = TestingSessionLocal()
            try:
                customer = Customer(
                    created_by_user_id=user.id,
                    full_name="Legacy Email Client",
                    emails="[{'label': 'work', 'email': 'nick@example.com'}]",
                    phone_number="123456",
                    tag="VIP Customer",
                    location="Old City",
                    public_token="legacy_email_token_123",
                    is_active=True,
                )
                session.add(customer)
                session.commit()
                customer_id = customer.id
            finally:
                session.close()

            response = client.get(f"/api/v2/customer/{customer_id}", headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert data["full_name"] == "Legacy Email Client"
            assert len(data["emails"]) == 1
            assert data["emails"][0]["email"] == "nick@example.com"
        finally:
            cleanup_user_by_email(email)

    def test_update_customer_with_ui_payload(self, client: TestClient):
        """Test updating a customer using new UI fields"""
        email = "customer_update@example.com"
        try:
            user = create_committed_user(email=email, username="custupdate", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # First create the customer
            create_payload = {
                "full_name": "Initial Name",
                "tag": "Regular Customer",
                "emails": [{"label": "Work", "email": "initial@vip.com"}],
                "phone_number": "+1000",
                "location": "Initial Loc",
                "status": "Active"
            }
            res_create = client.post("/api/v2/customer/", json=create_payload, headers=headers)
            assert res_create.status_code == 201
            customer_id = res_create.json()["id"]

            # Update the customer
            update_payload = {
                "full_name": "Updated Name",
                "tag": "VIP Customer",
                "emails": [
                    {"label": "Work", "email": "updated_work@vip.com"},
                    {"label": "Personal", "email": "updated_home@vip.com"}
                ],
                "phone_number": "+9999",
                "location": "Updated Loc",
                "status": "Inactive"
            }
            res_update = client.put(f"/api/v2/customer/{customer_id}", json=update_payload, headers=headers)
            assert res_update.status_code == 200

            data = res_update.json()
            assert data["full_name"] == "Updated Name"
            assert data["tag"] == "VIP Customer"
            assert len(data["emails"]) == 2
            assert data["emails"][0]["email"] == "updated_work@vip.com"
            assert data["emails"][1]["email"] == "updated_home@vip.com"
            assert data["phone_number"] == "+9999"
            assert data["location"] == "Updated Loc"
            assert data["status"] == "Inactive"
        finally:
            cleanup_user_by_email(email)

    def test_update_customer_with_flat_email_payload(self, client: TestClient):
        """Test updating a customer with a single flat email field"""
        email = "customer_update_flat_email@example.com"
        try:
            user = create_committed_user(email=email, username="custupdateflat", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            create_payload = {
                "full_name": "Initial Name",
                "emails": [{"label": "Work", "email": "initial@vip.com"}],
                "phone_number": "+1000",
                "location": "Initial Loc",
                "status": "Active",
            }
            res_create = client.post("/api/v2/customer/", json=create_payload, headers=headers)
            assert res_create.status_code == 201
            customer_id = res_create.json()["id"]

            update_payload = {
                "email": "UPDATES@VIP.COM",
                "status": "Active",
            }
            res_update = client.put(f"/api/v2/customer/{customer_id}", json=update_payload, headers=headers)
            assert res_update.status_code == 200

            data = res_update.json()
            assert len(data["emails"]) == 1
            assert data["emails"][0]["email"] == "updates@vip.com"
        finally:
            cleanup_user_by_email(email)

    def test_list_customers_success(self, client: TestClient):
        """Test listing multiple customers under the user's account with true count, search, and page fields"""
        email = "customer_list@example.com"
        try:
            user = create_committed_user(email=email, username="custlist", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # Create 3 customers
            for i in range(3):
                payload = {
                    "full_name": f"Customer {i}",
                    "tag": "VIP Customer",  # Valid Enum
                    "emails": [{"label": "Work", "email": f"cust{i}@domain.com"}],
                    "phone_number": f"+99{i}",
                    "location": "Location",
                    "status": "Active"
                }
                client.post("/api/v2/customer/", json=payload, headers=headers)

            response = client.get("/api/v2/customer/?skip=0&limit=10", headers=headers)
            assert response.status_code == 200

            data = response.json()
            assert data["total"] == 3
            assert data["page"] == 1
            assert len(data["items"]) == 3
            assert data["items"][0]["full_name"] == "Customer 2"  # Ordered by created_at desc
            assert data["items"][1]["full_name"] == "Customer 1"
            assert data["items"][2]["full_name"] == "Customer 0"

            # Test search by name
            res_search_name = client.get("/api/v2/customer/?search=Customer 1", headers=headers)
            assert res_search_name.status_code == 200
            data_name = res_search_name.json()
            assert data_name["total"] == 1
            assert len(data_name["items"]) == 1
            assert data_name["items"][0]["full_name"] == "Customer 1"

            # Test search by email
            res_search_email = client.get("/api/v2/customer/?search=cust2@domain.com", headers=headers)
            assert res_search_email.status_code == 200
            data_email = res_search_email.json()
            assert data_email["total"] == 1
            assert len(data_email["items"]) == 1
            assert data_email["items"][0]["full_name"] == "Customer 2"

        finally:
            cleanup_user_by_email(email)


    def test_delete_customer_soft(self, client: TestClient):
        """Test soft deleting a customer sets the is_deleted flag and excludes it from queries"""
        email = "customer_delete@example.com"
        try:
            user = create_committed_user(email=email, username="custdelete", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # Create customer
            payload = {
                "full_name": "To Be Deleted",
                "tag": "Regular Customer",
                "emails": [{"label": "Work", "email": "delete@vip.com"}],
                "phone_number": "+1234",
                "location": "A Place",
                "status": "Active"
            }
            res_create = client.post("/api/v2/customer/", json=payload, headers=headers)
            assert res_create.status_code == 201
            customer_id = res_create.json()["id"]

            # Soft delete customer
            res_delete = client.delete(f"/api/v2/customer/{customer_id}", headers=headers)
            assert res_delete.status_code == 200

            # Retrieval should now return 404
            res_get = client.get(f"/api/v2/customer/{customer_id}", headers=headers)
            assert res_get.status_code == 404

            # Listing should be empty (0 items)
            res_list = client.get("/api/v2/customer/?skip=0&limit=10", headers=headers)
            assert res_list.status_code == 200
            assert res_list.json()["total"] == 0
            assert len(res_list.json()["items"]) == 0
        finally:
            cleanup_user_by_email(email)

    def test_get_customer_design_shares_by_variant_includes_customer_details(self, client: TestClient):
        email = "customer_share_details@example.com"
        try:
            user = create_committed_user(email=email, username="custshare", full_name="Retailer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            session = TestingSessionLocal()
            try:
                customer = Customer(
                    created_by_user_id=user.id,
                    full_name="Shared Customer",
                    emails='[{"label": "Work", "email": "shared.customer@example.com"}]',
                    phone_number="+14155550100",
                    tag="VIP Customer",
                    location="New York",
                    public_token="shared_customer_token_001",
                    is_active=True,
                )
                session.add(customer)
                session.flush()

                design = Design(
                    user_id=user.id,
                    created_by_user_id=user.id,
                    design_code="CUS-001",
                    sequence_number=1,
                    name="Shared Pendant",
                    jewellery_type="Pendant",
                    user_prompt="Create a pendant",
                    status="GENERATED",
                )
                session.add(design)
                session.flush()

                variant = DesignVariant(
                    design_id=design.id,
                    variant_name="Variant A",
                    version_number=1,
                    is_selected=True,
                )
                session.add(variant)
                session.flush()

                share = DesignShare(
                    design_variant_id=variant.id,
                    customer_id=customer.id,
                    public_token="share_token_customer_details",
                    status="PENDING",
                    comment="Please review the finish",
                )
                session.add(share)
                session.commit()

                response = client.get(f"/api/v2/customer/{variant.id}/design_shares", headers=headers)
                assert response.status_code == 200

                data = response.json()
                assert isinstance(data, list)
                assert len(data) == 1

                share_data = data[0]
                assert share_data["customer_name"] == "Shared Customer"
                assert share_data["email"] == "shared.customer@example.com"
                assert share_data["customer_comment_or_feedback"] == "Please review the finish"
                assert share_data["status"] == "PENDING"
                assert share_data["shared_on"] is not None
            finally:
                session.close()
        finally:
            cleanup_user_by_email(email)
