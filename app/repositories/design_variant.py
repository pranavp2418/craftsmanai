from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.design import Design, DesignVariant


def detect_metal_tone(prompt: Optional[str], image_url: Optional[str]) -> Optional[dict]:
    # DISABLED: this pixel-based detector averages the image colours and mis-classifies
    # diamond-heavy YELLOW-GOLD pieces as 'silver' (the white diamonds wash out the gold),
    # then auto-seeds that wrong metal into metal_variations_json pointing at the base image.
    # That makes the UI think the colour already exists, so clicking that swatch never
    # regenerates. The base/refine tasks already set the correct base metal explicitly via
    # the reliable vision detector (detect_metal_color), so this auto-seed is not needed.
    return None

    if not image_url:
        return None

    metal = None

    # 1. Primary: Parse from prompt (since metadata/intent is the absolute source of truth)
    if prompt:
        lower = prompt.lower()
        if "rose gold" in lower or "rose-gold" in lower or "rose_gold" in lower:
            metal = "rose_gold"
        elif "white gold" in lower or "white-gold" in lower or "white_gold" in lower or "silver" in lower or "platinum" in lower or "sterling" in lower:
            metal = "silver"
        elif "yellow gold" in lower or "yellow-gold" in lower or "yellow_gold" in lower or "gold" in lower:
            metal = "gold"
            
    # 2. Secondary: If not specified in prompt, classify from the actual generated image color profile
    if not metal:
        try:
            import urllib.request
            import io
            from PIL import Image
            
            if image_url.startswith("http"):
                req = urllib.request.Request(
                    image_url, 
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    img_bytes = response.read()
                img = Image.open(io.BytesIO(img_bytes))
            else:
                img = Image.open(image_url)
                
            img = img.convert("RGB")
            img.thumbnail((100, 100))
            
            pixels = list(img.getdata())
            foreground = []
            for r, g, b in pixels:
                brightness = (r + g + b) / 3
                colorness = max(r, g, b) - min(r, g, b)
                
                # Filter background: if it is bright AND neutral, it is likely background
                if brightness > 190 and colorness < 20:
                    continue
                if r < 30 and g < 30 and b < 30:
                    continue
                foreground.append((r, g, b))
                
            if foreground:
                avg_r = sum(p[0] for p in foreground) / len(foreground)
                avg_g = sum(p[1] for p in foreground) / len(foreground)
                avg_b = sum(p[2] for p in foreground) / len(foreground)
                
                diff_rg = avg_r - avg_g
                diff_gb = avg_g - avg_b
                max_diff = max(abs(avg_r - avg_g), abs(avg_r - avg_b), abs(avg_g - avg_b))
                
                if max_diff < 15:
                    metal = "silver"
                elif diff_rg > 15:
                    # Rose gold has closer Green and Blue, whereas Yellow Gold has Green much higher than Blue
                    if diff_gb < 45:
                        metal = "rose_gold"
                    else:
                        metal = "gold"
                else:
                    metal = "silver"
        except Exception:
            pass
            
    if not metal:
        metal = "gold"
        
    return {metal: image_url}




class DesignVariantRepository:
    """Repository for managing design variants and lineage."""

    def __init__(self, db: Session):
        self.db = db

    def create_variant(
        self,
        *,
        design_id: int,
        variant_name: str,
        version_number: int,
        parent_variant_id: Optional[int] = None,
        base_design_image_url: Optional[str] = None,
        angles_json: Optional[dict] = None,
        metal_variations_json: Optional[dict] = None,
        prompt_used: Optional[str] = None,
        model_used: Optional[str] = None,
        is_selected: bool = False,
        design_focus: Optional[str] = None,
        style_tags: Optional[str] = None,
        reference_images_json: Optional[list] = None,
    ) -> DesignVariant:
        # Auto-detect metal tone if base_design_image_url is set and metal_variations_json is empty
        if base_design_image_url and not metal_variations_json:
            ref_image_url = None
            try:
                design = self.db.query(Design).filter(Design.id == design_id).first()
                if design and design.input_image_urls:
                    ref_image_url = design.input_image_urls[0]
                elif design and design.input_image_url:
                    ref_image_url = design.input_image_url
            except Exception:
                pass
            
            detect_source = ref_image_url or base_design_image_url
            detected = detect_metal_tone(prompt_used or style_tags or design_focus, detect_source)
            if detected:
                detected_key = list(detected.keys())[0]
                metal_variations_json = {detected_key: base_design_image_url}

        variant = DesignVariant(
            design_id=design_id,
            parent_variant_id=parent_variant_id,
            variant_name=variant_name,
            version_number=version_number,
            base_design_image_url=base_design_image_url,
            angles_json=angles_json,
            metal_variations_json=metal_variations_json,
            prompt_used=prompt_used,
            model_used=model_used,
            is_selected=is_selected,
            design_focus=design_focus,
            style_tags=style_tags,
            reference_images_json=reference_images_json,
        )
        self.db.add(variant)
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def get_by_id(self, variant_id: int) -> Optional[DesignVariant]:
        return self.db.query(DesignVariant).filter(DesignVariant.id == variant_id, DesignVariant.is_deleted.is_(False)).first()

    def list_for_design(self, design_id: int, skip: Optional[int] = None, limit: Optional[int] = None) -> List[DesignVariant]:
        query = (
            self.db.query(DesignVariant)
            .filter(
                DesignVariant.design_id == design_id,
                DesignVariant.is_archived.is_(False),
                DesignVariant.is_deleted.is_(False),
            )
            .order_by(DesignVariant.created_at.desc())
        )
        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def count_for_design(self, design_id: int) -> int:
        return (
            self.db.query(DesignVariant)
            .filter(
                DesignVariant.design_id == design_id,
                DesignVariant.is_archived.is_(False),
                DesignVariant.is_deleted.is_(False),
            )
            .count()
        )

    def list_archived_for_user(self, user_id: int, skip: Optional[int] = None, limit: Optional[int] = None) -> List[DesignVariant]:
        query = (
            self.db.query(DesignVariant)
            .join(Design, DesignVariant.design_id == Design.id)
            .filter(
                Design.user_id == user_id,
                DesignVariant.is_archived.is_(True),
                DesignVariant.is_deleted.is_(False),
            )
            .order_by(DesignVariant.created_at.desc())
        )
        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def count_archived_for_user(self, user_id: int) -> int:
        return (
            self.db.query(DesignVariant)
            .join(Design, DesignVariant.design_id == Design.id)
            .filter(
                Design.user_id == user_id,
                DesignVariant.is_archived.is_(True),
                DesignVariant.is_deleted.is_(False),
            )
            .count()
        )

    def get_selected_variant(self, design_id: int) -> Optional[DesignVariant]:
        return (
            self.db.query(DesignVariant)
            .filter(
                DesignVariant.design_id == design_id,
                DesignVariant.is_selected.is_(True),
                DesignVariant.is_deleted.is_(False),
            )
            .first()
        )

    def clear_selected(self, design_id: int) -> None:
        self.db.query(DesignVariant).filter(DesignVariant.design_id == design_id).update({DesignVariant.is_selected: False})
        self.db.commit()

    def set_selected(self, variant: DesignVariant, *, selected: bool = True) -> DesignVariant:
        variant.is_selected = selected
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def update_variant(self, variant: DesignVariant, **kwargs) -> DesignVariant:
        # Auto-detect metal tone on base image update
        new_image_url = kwargs.get("base_design_image_url")
        prompt = kwargs.get("prompt_used") or variant.prompt_used
        
        if new_image_url and "metal_variations_json" not in kwargs:
            ref_image_url = None
            try:
                design = self.db.query(Design).filter(Design.id == variant.design_id).first()
                if design and design.input_image_urls:
                    ref_image_url = design.input_image_urls[0]
                elif design and design.input_image_url:
                    ref_image_url = design.input_image_url
            except Exception:
                pass
            
            detect_source = ref_image_url or new_image_url
            detected = detect_metal_tone(prompt or variant.style_tags or variant.design_focus, detect_source)
            if detected:
                existing = dict(variant.metal_variations_json or {})
                for k in detected.keys():
                    existing[k] = new_image_url
                variant.metal_variations_json = existing
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(variant, "metal_variations_json")

        for field, value in kwargs.items():
            if hasattr(variant, field) and value is not None:
                setattr(variant, field, value)
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def delete_variant(self, variant: DesignVariant) -> DesignVariant:
        variant.is_deleted = True
        self.db.commit()
        self.db.refresh(variant)
        return variant