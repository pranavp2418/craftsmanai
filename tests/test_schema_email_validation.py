import pytest
from pydantic import ValidationError

from app.schemas.auth import LoginRequest, SignupRequest
from app.schemas.brand_setting import BrandSettingUpdateRequest
from app.schemas.customer import CustomerCreateRequest, CustomerUpdateRequest, EmailAddressSchema


class TestSchemaEmailValidation:
    def test_signup_request_normalizes_email(self):
        request = SignupRequest(
            email="User.Name@Example.COM",
            password="Password123",
            whatsapp_number="+12345678901",
        )

        assert request.email == "user.name@example.com"

    def test_login_request_normalizes_email(self):
        request = LoginRequest(email="ADMIN@Example.COM", password="Password123")

        assert request.email == "admin@example.com"

    def test_create_request_normalizes_nested_email(self):
        request = CustomerCreateRequest(
            full_name="Example Customer",
            emails=[EmailAddressSchema(label="Work", email="Sales@Example.COM")],
        )

        assert request.emails is not None
        assert request.emails[0].email == "sales@example.com"

    def test_update_request_normalizes_flat_email_payload(self):
        request = CustomerUpdateRequest(email="Support@Example.COM")

        assert request.emails is not None
        assert len(request.emails) == 1
        assert request.emails[0].email == "support@example.com"

    def test_update_request_rejects_invalid_email(self):
        with pytest.raises(ValidationError):
            CustomerUpdateRequest(email="not-an-email")

    def test_update_request_normalizes_business_email(self):
        request = BrandSettingUpdateRequest(business_email="Support@Example.COM")

        assert request.business_email == "support@example.com"

    def test_invalid_email_is_rejected(self):
        with pytest.raises(ValidationError):
            SignupRequest(
                email="not-an-email",
                password="Password123",
                whatsapp_number="+12345678901",
            )