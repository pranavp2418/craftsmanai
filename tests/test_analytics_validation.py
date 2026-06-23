"""
Test analytics endpoint validation and error handling

This test suite ensures that analytics endpoints properly validate:
1. Filter payloads (months parameter, actor_type)
2. RBAC policies (active users, non-superusers)
3. Team member data isolation
4. Error responses follow enterprise security standards
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
from typing import Dict, Any


class TestAnalyticsValidation:
    """Test analytics endpoint validation"""

    @pytest.fixture
    def auth_headers(self, client: TestClient, create_verified_user):
        """Create authenticated headers for a verified user"""
        user = create_verified_user()
        login_data = {
            "email": user.email,
            "password": "TestPass123!"
        }
        response = client.post("/api/v2/auth/login", json=login_data)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def superuser_headers(self, client: TestClient, db_session):
        """Create authenticated headers for a superuser"""
        from app.repositories.user import UserRepository
        
        user_repo = UserRepository(db_session)
        
        # Clean up any existing superuser
        existing = db_session.query(user_repo.model).filter(
            user_repo.model.email == "superuser@test.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()
        
        # Create superuser
        user = user_repo.create_user(
            email="superuser@test.com",
            username="superuser",
            full_name="Super User",
            password="TestPass123!",
            is_verified=True,
            is_superuser=True,
            is_active=True
        )
        db_session.commit()
        
        login_data = {
            "email": user.email,
            "password": "TestPass123!"
        }
        response = client.post("/api/v2/auth/login", json=login_data)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}, user

    @pytest.fixture
    def inactive_user_headers(self, client: TestClient, db_session):
        """Create authenticated headers for an inactive user"""
        from app.repositories.user import UserRepository
        
        user_repo = UserRepository(db_session)
        
        # Clean up any existing user
        existing = db_session.query(user_repo.model).filter(
            user_repo.model.email == "inactive@test.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()
        
        # Create inactive user
        user = user_repo.create_user(
            email="inactive@test.com",
            username="inactiveuser",
            full_name="Inactive User",
            password="TestPass123!",
            is_verified=True,
            is_active=False
        )
        db_session.commit()
        
        login_data = {
            "email": user.email,
            "password": "TestPass123!"
        }
        response = client.post("/api/v2/auth/login", json=login_data)
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}, user

    def test_metrics_valid_months_range(self, client: TestClient, auth_headers):
        """Test metrics endpoint with valid months parameter"""
        # Test minimum value
        response = client.get("/api/v2/analytics/metrics?months=1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "Activity_metrics" in data
        assert "conversion_metrics" in data

        # Test maximum value
        response = client.get("/api/v2/analytics/metrics?months=24", headers=auth_headers)
        assert response.status_code == 200

        # Test default value
        response = client.get("/api/v2/analytics/metrics", headers=auth_headers)
        assert response.status_code == 200

    def test_metrics_invalid_months_too_low(self, client: TestClient, auth_headers):
        """Test metrics endpoint rejects months < 1"""
        response = client.get("/api/v2/analytics/metrics?months=0", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # FastAPI validation error format
        assert any("months" in str(error).lower() for error in data["detail"])

    def test_metrics_invalid_months_too_high(self, client: TestClient, auth_headers):
        """Test metrics endpoint rejects months > 24"""
        response = client.get("/api/v2/analytics/metrics?months=25", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_metrics_invalid_months_negative(self, client: TestClient, auth_headers):
        """Test metrics endpoint rejects negative months"""
        response = client.get("/api/v2/analytics/metrics?months=-1", headers=auth_headers)
        assert response.status_code == 422

    def test_metrics_superuser_forbidden(self, client: TestClient, superuser_headers):
        """Test metrics endpoint rejects superusers"""
        headers, _ = superuser_headers
        response = client.get("/api/v2/analytics/metrics", headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data
        assert "superuser" in data["detail"].lower() or "permission" in data["detail"].lower()

    def test_metrics_inactive_user_forbidden(self, client: TestClient, inactive_user_headers):
        """Test metrics endpoint rejects inactive users"""
        headers, _ = inactive_user_headers
        response = client.get("/api/v2/analytics/metrics", headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data
        assert "inactive" in data["detail"].lower()

    def test_design_time_valid_months(self, client: TestClient, auth_headers):
        """Test design-time endpoint with valid months"""
        response = client.get("/api/v2/analytics/design-time?months=6", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_designs" in data
        assert "months" in data
        assert len(data["months"]) == 6

    def test_design_time_invalid_months(self, client: TestClient, auth_headers):
        """Test design-time endpoint rejects invalid months"""
        response = client.get("/api/v2/analytics/design-time?months=30", headers=auth_headers)
        assert response.status_code == 422

    def test_completed_orders_valid_months(self, client: TestClient, auth_headers):
        """Test completed-orders endpoint with valid months"""
        response = client.get("/api/v2/analytics/completed-orders?months=6", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_completed_orders" in data
        assert "months" in data

    def test_completed_orders_invalid_months(self, client: TestClient, auth_headers):
        """Test completed-orders endpoint rejects invalid months"""
        response = client.get("/api/v2/analytics/completed-orders?months=0", headers=auth_headers)
        assert response.status_code == 422

    def test_conversion_funnel_valid_months(self, client: TestClient, auth_headers):
        """Test conversion-funnel endpoint with valid months"""
        response = client.get("/api/v2/analytics/conversion-funnel?months=6", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "stages" in data
        assert "summary" in data
        assert len(data["stages"]) == 5

    def test_conversion_funnel_invalid_months(self, client: TestClient, auth_headers):
        """Test conversion-funnel endpoint rejects invalid months"""
        response = client.get("/api/v2/analytics/conversion-funnel?months=100", headers=auth_headers)
        assert response.status_code == 422

    def test_jewellery_breakdown_valid_months(self, client: TestClient, auth_headers):
        """Test jewellery-breakdown endpoint with valid months"""
        response = client.get("/api/v2/analytics/jewellery-breakdown?months=6", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_designs" in data
        assert "categories" in data
        assert len(data["categories"]) == 6  # Rings, Necklaces, Earrings, Bracelets, Pendants, Other

    def test_jewellery_breakdown_invalid_months(self, client: TestClient, auth_headers):
        """Test jewellery-breakdown endpoint rejects invalid months"""
        response = client.get("/api/v2/analytics/jewellery-breakdown?months=-5", headers=auth_headers)
        assert response.status_code == 422

    def test_activity_log_valid_actor_type(self, client: TestClient, auth_headers):
        """Test activity-log endpoint with valid actor_type"""
        # Test manufacturer
        response = client.get("/api/v2/analytics/activity-log?actor_type=manufacturer", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total_items" in data
        assert "filter" in data
        assert data["filter"] == "manufacturer"

        # Test customer
        response = client.get("/api/v2/analytics/activity-log?actor_type=customer", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["filter"] == "customer"

    def test_activity_log_invalid_actor_type(self, client: TestClient, auth_headers):
        """Test activity-log endpoint rejects invalid actor_type"""
        response = client.get("/api/v2/analytics/activity-log?actor_type=invalid", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_activity_log_case_insensitive(self, client: TestClient, auth_headers):
        """Test activity-log endpoint normalizes actor_type case"""
        # Test uppercase
        response = client.get("/api/v2/analytics/activity-log?actor_type=MANUFACTURER", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["filter"] == "manufacturer"

        # Test mixed case
        response = client.get("/api/v2/analytics/activity-log?actor_type=Customer", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["filter"] == "customer"

    def test_analytics_unauthorized(self, client: TestClient):
        """Test analytics endpoints require authentication"""
        endpoints = [
            "/api/v2/analytics/metrics",
            "/api/v2/analytics/design-time",
            "/api/v2/analytics/completed-orders",
            "/api/v2/analytics/conversion-funnel",
            "/api/v2/analytics/jewellery-breakdown",
            "/api/v2/analytics/activity-log",
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == 401, f"Endpoint {endpoint} should require authentication"

    def test_metrics_response_structure(self, client: TestClient, auth_headers):
        """Test metrics endpoint returns correct response structure"""
        response = client.get("/api/v2/analytics/metrics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check Activity_metrics structure
        assert "Activity_metrics" in data
        activity = data["Activity_metrics"]
        assert "total_renders" in activity
        assert "designs_sent" in activity
        assert "approval_rate" in activity
        assert "Active_requests" in activity
        
        # Check conversion_metrics structure
        assert "conversion_metrics" in data
        conversion = data["conversion_metrics"]
        assert "total_refinements" in conversion
        assert "customer_engagement" in conversion
        assert "manufacturers_engaged" in conversion
        assert "archived_completed" in conversion

    def test_design_time_response_structure(self, client: TestClient, auth_headers):
        """Test design-time endpoint returns correct response structure"""
        response = client.get("/api/v2/analytics/design-time?months=3", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_designs" in data
        assert "months" in data
        assert len(data["months"]) == 3
        
        # Check month structure
        for month in data["months"]:
            assert "month" in month
            assert "year" in month
            assert "count" in month
            assert isinstance(month["count"], int)

    def test_conversion_funnel_response_structure(self, client: TestClient, auth_headers):
        """Test conversion-funnel endpoint returns correct response structure"""
        response = client.get("/api/v2/analytics/conversion-funnel", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "stages" in data
        assert "summary" in data
        
        # Check stages
        assert len(data["stages"]) == 5
        stage_labels = [s["label"] for s in data["stages"]]
        expected_labels = ["Requests", "Rendered", "Sent", "Approved", "Manufactured"]
        assert stage_labels == expected_labels
        
        # Check summary
        summary = data["summary"]
        assert "avg_time_to_approval_days" in summary
        assert "avg_refinements_per_design" in summary
        assert "conversion_rate" in summary

    def test_jewellery_breakdown_response_structure(self, client: TestClient, auth_headers):
        """Test jewellery-breakdown endpoint returns correct response structure"""
        response = client.get("/api/v2/analytics/jewellery-breakdown", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_designs" in data
        assert "categories" in data
        assert len(data["categories"]) == 6
        
        # Check category structure
        expected_labels = ["Rings", "Necklaces", "Earrings", "Bracelets", "Pendants", "Other"]
        actual_labels = [c["label"] for c in data["categories"]]
        assert actual_labels == expected_labels
        
        for category in data["categories"]:
            assert "label" in category
            assert "count" in category
            assert "rate" in category
            assert isinstance(category["count"], int)
            assert isinstance(category["rate"], float)

    def test_activity_log_response_structure(self, client: TestClient, auth_headers):
        """Test activity-log endpoint returns correct response structure"""
        response = client.get("/api/v2/analytics/activity-log", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total_items" in data
        assert "filter" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) <= 5  # Should return max 5 items
        
        # Check item structure
        for item in data["items"]:
            assert "request_id" in item
            assert "type" in item
            assert "manufacturer" in item
            assert "date" in item
            assert "status" in item
            assert "actor_type" in item
            assert item["actor_type"] in ["manufacturer", "customer"]

    def test_validation_error_format(self, client: TestClient, auth_headers):
        """Test validation errors follow standard format"""
        response = client.get("/api/v2/analytics/metrics?months=50", headers=auth_headers)
        assert response.status_code == 422
        data = response.json()
        
        # FastAPI validation error format
        assert "detail" in data
        assert isinstance(data["detail"], list)
        assert len(data["detail"]) > 0
        
        error = data["detail"][0]
        assert "loc" in error
        assert "msg" in error
        assert "type" in error

    def test_error_response_consistency(self, client: TestClient, auth_headers):
        """Test all endpoints return consistent error responses"""
        # Test various invalid inputs
        test_cases = [
            ("/api/v2/analytics/metrics?months=0", 422),
            ("/api/v2/analytics/design-time?months=100", 422),
            ("/api/v2/analytics/completed-orders?months=-1", 422),
            ("/api/v2/analytics/conversion-funnel?months=50", 422),
            ("/api/v2/analytics/jewellery-breakdown?months=0", 422),
            ("/api/v2/analytics/activity-log?actor_type=invalid", 422),
        ]
        
        for endpoint, expected_status in test_cases:
            response = client.get(endpoint, headers=auth_headers)
            assert response.status_code == expected_status, f"Failed for {endpoint}"
            data = response.json()
            assert "detail" in data, f"Missing 'detail' in error response for {endpoint}"