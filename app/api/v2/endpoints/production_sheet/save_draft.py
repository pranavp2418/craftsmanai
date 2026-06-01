from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.production_sheet import ProductionSheet
from app.models.user import User
from app.schemas.production_sheet import ProductionSheetDraftRequest, ProductionSheetResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.services.supabase_service import upload_additional_note_image


router = APIRouter()


@router.post("/draft", response_model=ProductionSheetResponse, status_code=status.HTTP_201_CREATED)
def save_production_sheet_draft(
    payload: ProductionSheetDraftRequest | None = None,
    payload_json: str | None = Form(None),
    variant_id: int = Query(..., ge=1),
    production_sheet_id: int | None = Query(None, ge=1),
    manufacturing_image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    design = design_service.get_design_for_team_member(design_id=variant.design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    if payload is None:
        if payload_json is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing payload body or payload form field")
        try:
            parsed = json.loads(payload_json)
            payload = ProductionSheetDraftRequest.model_validate(parsed)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    manufacturing_image_url = None
    if manufacturing_image is not None:
        manufacturing_image_url = upload_additional_note_image(manufacturing_image)

    production_sheet = (
        db.query(ProductionSheet)
        .filter(
            ProductionSheet.variant_id == variant.id,
            ProductionSheet.user_id == current_user.id,
        )
        .first()
    )

    if production_sheet_id is not None:
        production_sheet = (
            db.query(ProductionSheet)
            .filter(
                ProductionSheet.id == production_sheet_id,
                ProductionSheet.user_id == current_user.id,
            )
            .first()
        )
        if not production_sheet:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production sheet not found")
    elif production_sheet is None:
        production_sheet = ProductionSheet(user_id=current_user.id, variant_id=variant.id)
        db.add(production_sheet)

    production_sheet.variant_id = variant.id
    production_sheet.budget_range = payload.budget_range
    production_sheet.metal_details = payload.metal_details
    production_sheet.stone_type = payload.stone_type
    production_sheet.setting_type = payload.setting_type
    production_sheet.stone_count = payload.stone_count
    production_sheet.stone_size = payload.stone_size
    production_sheet.dimension = payload.dimension
    production_sheet.manufacturing_notes = payload.manufacturing_notes
    if manufacturing_image_url is not None:
        production_sheet.manufacturing_image = manufacturing_image_url

    db.commit()
    db.refresh(production_sheet)
    return production_sheet
