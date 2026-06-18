from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field

from app.models.design import DesignShareStatus, DesignStatus


class PublicDesignAccessRequest(BaseModel):
    token: str = Field(..., min_length=1)


class PublicDesignAccessResponse(BaseModel):
    design_id: int
    design_code: str
    name: Optional[str] = None
    jewellery_type: Optional[str] = None
    user_prompt: Optional[str] = None
    input_image_url: Optional[str] = None
    status: DesignStatus

    class Config:
        from_attributes = True


class PublicDesignVariantResponse(BaseModel):
    id: int
    variant_name: str
    version_number: int
    base_design_image_url: Optional[str] = None
    angles_json: Optional[Dict[str, Any]] = None
    metal_variations_json: Optional[Dict[str, Any]] = None
    is_selected: bool
    created_at: datetime

    class Config:
        from_attributes = True


from app.schemas.production_sheet import ProductionSheetResponse

class PublicDesignFullResponse(BaseModel):
    design: PublicDesignAccessResponse
    variants: List[PublicDesignVariantResponse]
    share_status: Optional[DesignShareStatus] = None
    share_comment: Optional[str] = None
    public_token: str
    production_sheet: Optional[ProductionSheetResponse] = None
    brand_logo_url: Optional[str] = None
    brand_primary_color: Optional[str] = None

    


class PublicStatusUpdateRequest(BaseModel):
    token: str = Field(..., min_length=1)
    comment: Optional[str] = None


class PublicStatusUpdateResponse(BaseModel):
    success: bool
    message: str


class PublicCustomerAccessResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None

    class Config:
        from_attributes = True


class PublicManufacturerAccessResponse(BaseModel):
    id: int
    name: str
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None

    class Config:
        from_attributes = True