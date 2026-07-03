import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.design import DesignStatus
from app.models.design import DesignActivityLog
from app.models.user import User
from app.repositories.design import DesignRepository
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.manufacturer import ManufacturerRepository
from app.services.manufacturer_variant_share_service import DesignVariantManufacturerShareService


def _override_user(client: TestClient, user: User):
    async def override_current_user():
        return user

    client.app.dependency_overrides[get_current_active_user] = override_current_user


def _override_db(client: TestClient, db_session: Session):
    def override_get_db():
        yield db_session

    client.app.dependency_overrides[get_db] = override_get_db


def test_variant_manufacturer_shares_returns_design_status_and_manufacturers(
    client: TestClient,
    db_session: Session,
    create_verified_user,
):
    owner = create_verified_user(
        email=f"owner_{uuid.uuid4().hex[:8]}@example.com",
        username=f"owner_{uuid.uuid4().hex[:8]}",
        full_name="Owner User",
    )

    design_repo = DesignRepository(db_session)
    variant_repo = DesignVariantRepository(db_session)
    manufacturer_repo = ManufacturerRepository(db_session)
    share_service = DesignVariantManufacturerShareService(db_session)

    design = design_repo.create_design(
        user_id=owner.id,
        design_code=f"DES-{uuid.uuid4().hex[:10].upper()}",
        sequence_number=1,
        name="Shared Ring Design",
        jewellery_type="ring",
        user_prompt="A modern ring",
        status=DesignStatus.SHARED,
    )
    variant = variant_repo.create_variant(
        design_id=design.id,
        variant_name="Variant A",
        version_number=1,
        base_design_image_url="https://example.com/variant-a.png",
        is_selected=True,
    )

    manufacturer_one = manufacturer_repo.create_manufacturer(
        created_by_user_id=owner.id,
        name="North Star Manufacturing",
        emails='[{"label":"Work","email":"northstar@example.com"}]',
        phone_number="+15550001",
        location="New York",
    )
    manufacturer_two = manufacturer_repo.create_manufacturer(
        created_by_user_id=owner.id,
        name="Aurora Jewels",
        emails='[{"label":"Work","email":"aurora@example.com"}]',
        phone_number="+15550002",
        location="Los Angeles",
    )

    share_service.create_share(design_variant_id=variant.id, manufacturer_id=manufacturer_one.id)
    share_service.create_share(design_variant_id=variant.id, manufacturer_id=manufacturer_two.id)

    _override_user(client, owner)
    _override_db(client, db_session)
    try:
        response = client.get(f"/api/v2/design-variant/variants/{variant.id}/manufacturer-shares")
    finally:
        client.app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["variant_id"] == variant.id
    assert payload["design_id"] == design.id
    assert payload["design_variant_status"] == DesignStatus.SHARED.value
    assert payload["design_status"] == DesignStatus.SHARED.value
    assert payload["total_shares"] == 2
    assert payload["design_name"] == design.name
    assert {share["manufacturer"]["name"] for share in payload["shares"]} == {
        manufacturer_one.name,
        manufacturer_two.name,
    }
    assert {share["manufacturer"]["location"] for share in payload["shares"]} == {"New York", "Los Angeles"}
    assert all(share["shared_date"] for share in payload["shares"])
    assert {share["quoted_price"] for share in payload["shares"]} == {None}
    assert {share["estimated_delivery_date"] for share in payload["shares"]} == {None}
    assert {share["manufacturer_notes"] for share in payload["shares"]} == {None}


def test_share_with_manufacturer_returns_review_url_and_logs_metadata(
    client: TestClient,
    db_session: Session,
    create_verified_user,
):
    owner = create_verified_user(
        email=f"owner_{uuid.uuid4().hex[:8]}@example.com",
        username=f"owner_{uuid.uuid4().hex[:8]}",
        full_name="Owner User",
    )

    design_repo = DesignRepository(db_session)
    variant_repo = DesignVariantRepository(db_session)
    manufacturer_repo = ManufacturerRepository(db_session)
    from app.repositories.design_share import DesignShareRepository
    share_repo = DesignShareRepository(db_session)

    design = design_repo.create_design(
        user_id=owner.id,
        design_code=f"DES-{uuid.uuid4().hex[:10].upper()}",
        sequence_number=1,
        name="Shared Bracelet Design",
        jewellery_type="bracelet",
        user_prompt="A modern bracelet",
        status=DesignStatus.SHARED,
    )
    variant = variant_repo.create_variant(
        design_id=design.id,
        variant_name="Variant B",
        version_number=1,
        base_design_image_url="https://example.com/variant-b.png",
        is_selected=True,
    )

    # Share with customer first to satisfy constraint
    share_repo.create_share(
        design_variant_id=variant.id,
        public_token=f"cust-{uuid.uuid4().hex}",
        shared_metal="Gold",
    )

    manufacturer = manufacturer_repo.create_manufacturer(
        created_by_user_id=owner.id,
        name="North Star Manufacturing",
        emails='[{"label":"Work","email":"northstar@example.com"}]',
        phone_number="+15550001",
        location="New York",
    )

    _override_user(client, owner)
    _override_db(client, db_session)
    try:
        response = client.post(
            f"/api/v2/design-variant/variants/{variant.id}/share-with-manufacturer",
            json={"manufacturer_ids": [manufacturer.id]},
        )
    finally:
        client.app.dependency_overrides.clear()

    assert response.status_code == 201, response.text
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 1
    share_data = payload[0]

    expected_review_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/manufacturer/review/{manufacturer.public_token}?token={share_data['public_token']}"
    )

    assert share_data["design_variant_id"] == variant.id
    assert share_data["manufacturer_id"] == manufacturer.id
    assert share_data["review_url"] == expected_review_url

    log_entry = (
        db_session.query(DesignActivityLog)
        .filter(DesignActivityLog.design_id == design.id)
        .order_by(DesignActivityLog.created_at.desc())
        .first()
    )
    assert log_entry is not None
    assert log_entry.action_type == "VARIANT_SHARED_WITH_MANUFACTURER"
    assert log_entry.metadata_json["review_url"] == expected_review_url


def test_share_with_manufacturer_sends_to_specified_emails(
    client: TestClient,
    db_session: Session,
    create_verified_user,
):
    """Test that sharing with a manufacturer sends to specified emails from payload."""
    owner = create_verified_user(
        email=f"owner_{uuid.uuid4().hex[:8]}@example.com",
        username=f"owner_{uuid.uuid4().hex[:8]}",
        full_name="Owner User",
    )

    design_repo = DesignRepository(db_session)
    variant_repo = DesignVariantRepository(db_session)
    manufacturer_repo = ManufacturerRepository(db_session)
    from app.repositories.design_share import DesignShareRepository
    share_repo = DesignShareRepository(db_session)

    design = design_repo.create_design(
        user_id=owner.id,
        design_code=f"DES-{uuid.uuid4().hex[:10].upper()}",
        sequence_number=1,
        name="Test Design",
        jewellery_type="ring",
        user_prompt="Test",
        status=DesignStatus.SHARED,
    )
    variant = variant_repo.create_variant(
        design_id=design.id,
        variant_name="Variant Test",
        version_number=1,
        base_design_image_url="https://example.com/variant.png",
        is_selected=True,
    )

    # Share with customer first
    share_repo.create_share(
        design_variant_id=variant.id,
        public_token=f"cust-{uuid.uuid4().hex}",
        shared_metal="Gold",
    )

    # Create manufacturer with multiple emails
    manufacturer = manufacturer_repo.create_manufacturer(
        created_by_user_id=owner.id,
        name="Multi Email Manufacturer",
        emails='[{"label":"Work","email":"work@example.com"},{"label":"Personal","email":"personal@example.com"}]',
        phone_number="+15550001",
        location="New York",
    )

    _override_user(client, owner)
    _override_db(client, db_session)
    try:
        # Share with specific email selection
        response = client.post(
            f"/api/v2/design-variant/variants/{variant.id}/share-with-manufacturer",
            json={
                "manufacturer_ids": [manufacturer.id],
                "emails": {
                    str(manufacturer.id): ["work@example.com", "personal@example.com"]
                }
            },
        )
    finally:
        client.app.dependency_overrides.clear()

    assert response.status_code == 201, response.text
    payload = response.json()
    assert len(payload) == 1
    
    # Verify the share was created with sent_to_email set
    from app.models.design import DesignVariantManufacturerShare
    share = db_session.query(DesignVariantManufacturerShare).filter(
        DesignVariantManufacturerShare.id == payload[0]["id"]
    ).first()
    
    assert share is not None
    assert share.sent_to_email == "work@example.com"  # First email in the list


def test_resend_sends_to_pending_and_accepted_shares(
    client: TestClient,
    db_session: Session,
    create_verified_user,
):
    """Test that resend API sends to shares with both PENDING and ACCEPTED status."""
    from unittest.mock import patch, MagicMock

    owner = create_verified_user(
        email=f"owner_{uuid.uuid4().hex[:8]}@example.com",
        username=f"owner_{uuid.uuid4().hex[:8]}",
        full_name="Owner User",
    )

    design_repo = DesignRepository(db_session)
    variant_repo = DesignVariantRepository(db_session)
    manufacturer_repo = ManufacturerRepository(db_session)
    from app.repositories.design_share import DesignShareRepository
    share_repo = DesignShareRepository(db_session)

    design = design_repo.create_design(
        user_id=owner.id,
        design_code=f"DES-{uuid.uuid4().hex[:10].upper()}",
        sequence_number=1,
        name="Test Design",
        jewellery_type="ring",
        user_prompt="Test",
        status=DesignStatus.SHARED,
    )
    variant = variant_repo.create_variant(
        design_id=design.id,
        variant_name="Variant Test",
        version_number=1,
        base_design_image_url="https://example.com/variant.png",
        is_selected=True,
    )

    # Share with customer first
    share_repo.create_share(
        design_variant_id=variant.id,
        public_token=f"cust-{uuid.uuid4().hex}",
        shared_metal="Gold",
    )

    # Create two manufacturers
    manufacturer1 = manufacturer_repo.create_manufacturer(
        created_by_user_id=owner.id,
        name="Manufacturer 1",
        emails='[{"label":"Work","email":"m1@example.com"}]',
        phone_number="+15550001",
        location="New York",
    )
    manufacturer2 = manufacturer_repo.create_manufacturer(
        created_by_user_id=owner.id,
        name="Manufacturer 2",
        emails='[{"label":"Work","email":"m2@example.com"}]',
        phone_number="+15550002",
        location="Los Angeles",
    )

    # Create shares with different statuses
    share_service = DesignVariantManufacturerShareService(db_session)
    share1 = share_service.create_share(
        design_variant_id=variant.id,
        manufacturer_id=manufacturer1.id,
        shared_metal="Gold",
    )
    share1.status = "ACCEPTED"
    share1.sent_to_email = "m1@example.com"

    share2 = share_service.create_share(
        design_variant_id=variant.id,
        manufacturer_id=manufacturer2.id,
        shared_metal="Gold",
    )
    share2.status = "PENDING"
    share2.sent_to_email = "m2@example.com"

    db_session.commit()

    # Mock the Celery task to run synchronously
    mock_task = MagicMock(return_value=MagicMock(id="test-task-id"))

    _override_user(client, owner)
    _override_db(client, db_session)
    try:
        with patch(
            "app.api.v2.endpoints.design_variant.resend_manufacturer_emails.resend_manufacturer_share_email",
            mock_task
        ):
            response = client.post(
                f"/api/v2/design-variant/variants/{variant.id}/resend-manufacturer-emails",
            )
    finally:
        client.app.dependency_overrides.clear()

    assert response.status_code == 202, response.text
    payload = response.json()

    # Both PENDING and ACCEPTED shares should be queued
    assert payload["total_shares"] == 2  # Both shares
    assert payload["queued_count"] == 2
    assert payload["skipped_count"] == 0
    assert len(payload["items"]) == 2

    # Verify both shares are in the response
    share_ids = {item["share_id"] for item in payload["items"]}
    manufacturer_ids = {item["manufacturer_id"] for item in payload["items"]}
    assert share_ids == {share1.id, share2.id}
    assert manufacturer_ids == {manufacturer1.id, manufacturer2.id}

    # Verify the Celery task was called for both shares
    assert mock_task.delay.call_count == 2
