"""
Simple test to verify that customer view shows approved manufacturer and creator.
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.design import Design, DesignVariant, DesignStatus
from app.models.customer import Customer
from app.models.manufacturer import Manufacturer
from app.models.order import Order, OrderStatus, ManufacturerQuote, ManufacturerQuoteStatus
from app.models.design import DesignShare
from app.models.subscription import SubscriptionPlan, UserSubscription, SubscriptionStatus
from app.models.brand_setting import BrandSetting
import uuid
from datetime import datetime, timezone
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def setup_test_data():
    """Create test data for verification."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Create user (designer)
        user = User(
            email="designer@test.com",
            password_hash=pwd_context.hash("password123"),
            name="John Designer",
            is_active=True,
        )
        db.add(user)
        db.flush()
        
        # Create customer
        customer = Customer(
            name="Test Customer",
            email="customer@test.com",
            phone="+1234567890",
            is_active=True,
        )
        db.add(customer)
        db.flush()
        
        # Create manufacturer
        manufacturer = Manufacturer(
            name="Test Manufacturer",
            created_by_user_id=user.id,
            emails="mfg@test.com",
            phone_number="+0987654321",
            location="Mumbai",
            is_active=True,
            public_token=f"m-{uuid.uuid4().hex}",
        )
        db.add(manufacturer)
        db.flush()
        
        # Create subscription plan
        plan = SubscriptionPlan(
            name="Pro Plan",
            can_use_logo=True,
            can_use_brand_name=True,
            can_use_custom_color=True,
        )
        db.add(plan)
        db.flush()
        
        # Create subscription
        subscription = UserSubscription(
            user_id=user.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            start_date=datetime.now(timezone.utc),
            end_date=datetime.now(timezone.utc),
        )
        db.add(subscription)
        db.flush()
        
        # Create brand setting
        brand_setting = BrandSetting(
            user_id=user.id,
            logo_url="https://example.com/logo.png",
            primary_color="#6366F1",
        )
        db.add(brand_setting)
        db.flush()
        
        # Create design
        design = Design(
            user_id=user.id,
            created_by_user_id=user.id,
            design_code="TEST-001",
            sequence_number=1,
            name="Test Design",
            jewellery_type="Ring",
            status=DesignStatus.MANUFACTURER_APPROVED,
        )
        db.add(design)
        db.flush()
        
        # Create variant
        variant = DesignVariant(
            design_id=design.id,
            variant_name="Variant 1",
            version_number=1,
            is_selected=True,
        )
        db.add(variant)
        db.flush()
        
        # Create design share for customer
        share = DesignShare(
            design_variant_id=variant.id,
            customer_id=customer.id,
            public_token=f"share-{uuid.uuid4().hex}",
            status="ACCEPTED",
        )
        db.add(share)
        db.flush()
        
        # Create order
        order = Order(
            design_id=design.id,
            share_id=share.id,
            customer_id=customer.id,
            current_manufacturer_id=manufacturer.id,
            status=OrderStatus.APPROVED,
        )
        db.add(order)
        db.flush()
        
        # Create manufacturer quote
        quote = ManufacturerQuote(
            order_id=order.id,
            manufacturer_id=manufacturer.id,
            cost_price=1000.0,
            delivery_time_days=30,
            status=ManufacturerQuoteStatus.APPROVED,
        )
        db.add(quote)
        db.commit()
        
        return {
            "share_token": share.public_token,
            "design_id": design.id,
            "manufacturer_id": manufacturer.id,
            "user_id": user.id,
        }
        
    finally:
        db.close()

def test_customer_view_shows_manufacturer_and_creator():
    """Test that customer view API returns approved manufacturer and creator."""
    from app.main import app
    
    # Setup test data
    test_data = setup_test_data()
    
    client = TestClient(app)
    
    # Call customer access endpoint
    response = client.get(f"/public/customer/access?token={test_data['share_token']}")
    
    print(f"\nResponse Status: {response.status_code}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    data = response.json()
    print(f"\nResponse Data:")
    print(f"  Design Code: {data['design']['design_code']}")
    print(f"  Design Status: {data['design']['status']}")
    print(f"  Created By: {data['design'].get('created_by')}")
    print(f"  Approved Manufacturer: {data.get('approved_manufacturer')}")
    
    # Verify created_by is present
    assert data['design']['created_by'] is not None, "created_by should not be None"
    assert data['design']['created_by'] == "John Designer", f"Expected 'John Designer', got {data['design']['created_by']}"
    
    # Verify approved_manufacturer is present
    assert data['approved_manufacturer'] is not None, "approved_manufacturer should not be None"
    assert data['approved_manufacturer']['id'] == test_data['manufacturer_id'], "Manufacturer ID mismatch"
    assert data['approved_manufacturer']['name'] == "Test Manufacturer", f"Expected 'Test Manufacturer', got {data['approved_manufacturer']['name']}"
    assert data['approved_manufacturer']['company_name'] is None
    assert data['approved_manufacturer']['email'] == "mfg@test.com"
    assert data['approved_manufacturer']['phone'] == "+0987654321"
    assert data['approved_manufacturer']['location'] == "Mumbai"
    
    print("\n✅ All assertions passed!")
    print("✅ Customer view now shows approved manufacturer and creator name")

if __name__ == "__main__":
    test_customer_view_shows_manufacturer_and_creator()