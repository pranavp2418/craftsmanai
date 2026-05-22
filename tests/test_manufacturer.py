import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import TestingSessionLocal
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
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
            session.query(Manufacturer).filter(Manufacturer.created_by_user_id == existing.id).delete()
            session.query(User).filter(User.id == existing.id).delete()
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
    """Helper to clean up the committed user and associated manufacturers"""
    session = TestingSessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if user:
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == user.id).delete()
            session.query(Manufacturer).filter(Manufacturer.created_by_user_id == user.id).delete()
            session.query(User).filter(User.id == user.id).delete()
            session.commit()
    finally:
        session.close()


class TestManufacturerEndpoints:
    def test_create_manufacturer_success(self, client: TestClient):
        """Test creating a manufacturer with new UI payload"""
        email = "mfg_create@example.com"
        try:
            user = create_committed_user(email=email, username="mfgcreate", full_name="Designer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "name": "ArtisanGold Co.",
                "speciality": "Gold Specialist",
                "emails": [
                    {"label": "Work", "email": "orders@artisangold.it"},
                    {"label": "Production", "email": "production@artisangold.it"}
                ],
                "phone_number": "+39 02 4567 8901",
                "location": "Milan, Italy"
            }

            response = client.post("/api/v2/manufacturer/", json=payload, headers=headers)
            assert response.status_code == 201

            data = response.json()
            assert data["name"] == "ArtisanGold Co."
            assert data["speciality"] == "Gold Specialist"
            assert len(data["emails"]) == 2
            assert data["emails"][0]["label"] == "Work"
            assert data["emails"][0]["email"] == "orders@artisangold.it"
            assert data["phone_number"] == "+39 02 4567 8901"
            assert data["location"] == "Milan, Italy"
            assert data["status"] == "Active"
        finally:
            cleanup_user_by_email(email)

    def test_get_manufacturer_detail(self, client: TestClient):
        """Test getting a manufacturer detail with stats, sent requests, and production timeline"""
        email = "mfg_get@example.com"
        try:
            user = create_committed_user(email=email, username="mfgget", full_name="Designer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # Create manufacturer
            payload = {
                "name": "GemCraft Paris",
                "speciality": "Gemstone Specialist",
                "emails": [{"label": "Studio", "email": "studio@gemcraftparis.fr"}],
                "phone_number": "+33 1 2345 6789",
                "location": "Paris, France"
            }
            res_create = client.post("/api/v2/manufacturer/", json=payload, headers=headers)
            assert res_create.status_code == 201
            mfg_id = res_create.json()["id"]

            # Get manufacturer detail
            res_get = client.get(f"/api/v2/manufacturer/{mfg_id}", headers=headers)
            assert res_get.status_code == 200

            data = res_get.json()
            assert data["name"] == "GemCraft Paris"
            assert data["speciality"] == "Gemstone Specialist"
            assert data["stats"]["total_requests"] == 0
            assert data["stats"]["completed_requests"] == 0
            assert data["stats"]["total_profit"] == 0.0
            assert data["stats"]["pending_requests"] == 0
            assert data["stats"]["avg_response_time"] == "18 hrs"
            assert isinstance(data["sent_requests"], list)
            assert isinstance(data["production_timeline"], list)
        finally:
            cleanup_user_by_email(email)

    def test_update_manufacturer(self, client: TestClient):
        """Test updating a manufacturer's details"""
        email = "mfg_update@example.com"
        try:
            user = create_committed_user(email=email, username="mfgupdate", full_name="Designer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # Create manufacturer
            payload = {
                "name": "Old Name",
                "speciality": "Silver Specialist",
                "emails": [{"label": "Work", "email": "old@silver.com"}],
                "phone_number": "+111",
                "location": "Old Location"
            }
            res_create = client.post("/api/v2/manufacturer/", json=payload, headers=headers)
            assert res_create.status_code == 201
            mfg_id = res_create.json()["id"]

            # Update manufacturer
            update_payload = {
                "name": "New Name",
                "speciality": "Platinum Specialist",
                "emails": [
                    {"label": "Work", "email": "new@silver.com"},
                    {"label": "Production", "email": "prod@silver.com"}
                ],
                "phone_number": "+222",
                "location": "New Location",
                "is_active": False
            }
            res_update = client.put(f"/api/v2/manufacturer/{mfg_id}", json=update_payload, headers=headers)
            assert res_update.status_code == 200

            data = res_update.json()
            assert data["name"] == "New Name"
            assert data["speciality"] == "Platinum Specialist"
            assert len(data["emails"]) == 2
            assert data["phone_number"] == "+222"
            assert data["location"] == "New Location"
            assert data["status"] == "Inactive"
        finally:
            cleanup_user_by_email(email)

    def test_list_manufacturers(self, client: TestClient):
        """Test listing multiple manufacturers with correct pagination counts, search, and page fields"""
        email = "mfg_list@example.com"
        try:
            user = create_committed_user(email=email, username="mfglist", full_name="Designer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # Create 3 manufacturers
            for i in range(3):
                payload = {
                    "name": f"Manufacturer {i}",
                    "speciality": "Diamond Setting",
                    "emails": [{"label": "Work", "email": f"mfg{i}@diamond.com"}],
                    "phone_number": f"+99{i}",
                    "location": "Location"
                }
                client.post("/api/v2/manufacturer/", json=payload, headers=headers)

            response = client.get("/api/v2/manufacturer/?skip=0&limit=10", headers=headers)
            assert response.status_code == 200

            data = response.json()
            assert data["total"] == 3
            assert data["page"] == 1
            assert len(data["items"]) == 3
            assert data["items"][0]["name"] == "Manufacturer 2"
            assert data["items"][1]["name"] == "Manufacturer 1"
            assert data["items"][2]["name"] == "Manufacturer 0"

            # Test search by name
            res_search_name = client.get("/api/v2/manufacturer/?search=Manufacturer 1", headers=headers)
            assert res_search_name.status_code == 200
            data_name = res_search_name.json()
            assert data_name["total"] == 1
            assert len(data_name["items"]) == 1
            assert data_name["items"][0]["name"] == "Manufacturer 1"

            # Test search by email
            res_search_email = client.get("/api/v2/manufacturer/?search=mfg2@diamond.com", headers=headers)
            assert res_search_email.status_code == 200
            data_email = res_search_email.json()
            assert data_email["total"] == 1
            assert len(data_email["items"]) == 1
            assert data_email["items"][0]["name"] == "Manufacturer 2"

        finally:
            cleanup_user_by_email(email)


    def test_delete_manufacturer_soft(self, client: TestClient):
        """Test soft deleting a manufacturer sets the is_deleted flag and excludes it from queries"""
        email = "mfg_delete@example.com"
        try:
            user = create_committed_user(email=email, username="mfgdelete", full_name="Designer Admin")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # Create manufacturer
            payload = {
                "name": "To Be Deleted",
                "speciality": "Gold Specialist",
                "emails": [{"label": "Work", "email": "delete@mfg.com"}],
                "phone_number": "+1234",
                "location": "A Factory"
            }
            res_create = client.post("/api/v2/manufacturer/", json=payload, headers=headers)
            assert res_create.status_code == 201
            mfg_id = res_create.json()["id"]

            # Soft delete manufacturer
            res_delete = client.delete(f"/api/v2/manufacturer/{mfg_id}", headers=headers)
            assert res_delete.status_code == 200

            # Retrieval should now return 404
            res_get = client.get(f"/api/v2/manufacturer/{mfg_id}", headers=headers)
            assert res_get.status_code == 404

            # Listing should be empty (0 items)
            res_list = client.get("/api/v2/manufacturer/?skip=0&limit=10", headers=headers)
            assert res_list.status_code == 200
            assert res_list.json()["total"] == 0
            assert len(res_list.json()["items"]) == 0
        finally:
            cleanup_user_by_email(email)
