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
        public_token=f"m-{uuid.uuid4().hex}",
        emails='[{"label":"Work","email":"northstar@example.com"}]',
        phone_number="+15550001",
        location="New York",
    )
    manufacturer_two = manufacturer_repo.create_manufacturer(
        created_by_user_id=owner.id,
        name="Aurora Jewels",
        public_token=f"m-{uuid.uuid4().hex}",
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

    manufacturer = manufacturer_repo.create_manufacturer(
        created_by_user_id=owner.id,
        name="North Star Manufacturing",
        public_token=f"m-{uuid.uuid4().hex}",
        emails='[{"label":"Work","email":"northstar@example.com"}]',
        phone_number="+15550001",
        location="New York",
    )

    _override_user(client, owner)
    _override_db(client, db_session)
    try:
        response = client.post(
            f"/api/v2/design-variant/variants/{variant.id}/share-with-manufacturer",
            json={"manufacturer_id": manufacturer.id},
        )
    finally:
        client.app.dependency_overrides.clear()

    assert response.status_code == 201, response.text
    payload = response.json()

    expected_review_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}"
        f"/manufacturer/review/{manufacturer.public_token}?token={payload['public_token']}"
    )

    assert payload["design_variant_id"] == variant.id
    assert payload["manufacturer_id"] == manufacturer.id
    assert payload["review_url"] == expected_review_url

    log_entry = (
        db_session.query(DesignActivityLog)
        .filter(DesignActivityLog.design_id == design.id)
        .order_by(DesignActivityLog.created_at.desc())
        .first()
    )
    assert log_entry is not None
    assert log_entry.action_type == "VARIANT_SHARED_WITH_MANUFACTURER"
    assert log_entry.metadata_json["review_url"] == expected_review_url
