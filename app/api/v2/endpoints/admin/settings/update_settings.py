from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Any, List

from app.api import deps
from app.models.settings import SystemSettings, SystemSettingsLog
from app.schemas.settings import SystemSettingsUpdate, SystemSettingsResponse, SystemSettingsLogResponse

router = APIRouter()

@router.post("/", response_model=SystemSettingsResponse, summary="Add or Update System Settings")
async def add_or_update_settings(
    *,
    db: AsyncSession = Depends(deps.get_db),
    settings_in: SystemSettingsUpdate,
    current_admin: Any = Depends(deps.get_current_admin)
) -> Any:
    """
    Unified API to create or update global system settings.
    - If no settings exist, it creates the first record with defaults + provided values.
    - If settings exist, it updates only the fields provided in the request.
    - Logs every individual change for audit trails.
    """
    # 1. Fetch the first settings record
    result = await db.execute(select(SystemSettings).order_by(SystemSettings.id.asc()))
    db_settings = result.scalars().first()

    # 2. Extract input data
    # exclude_unset=True is crucial for partial updates
    update_data = settings_in.model_dump(exclude_unset=True)

    if not db_settings:
        # --- CREATE FLOW ---
        # Create new record using all fields (includes Pydantic defaults)
        db_settings = SystemSettings(**settings_in.model_dump())
        db.add(db_settings)
        await db.flush() # Ensure ID and other DB-generated fields are ready
        
        # Log the initial creation
        log = SystemSettingsLog(
            admin_id=current_admin.id,
            changed_field="INITIAL_CREATION",
            old_value=None,
            new_value="System settings initialized with defaults and provided values"
        )
        db.add(log)
    else:
        # --- UPDATE FLOW ---
        # Iterate only over the fields provided in the request
        for field, value in update_data.items():
            if hasattr(db_settings, field):
                old_val = getattr(db_settings, field)
                # Only log and update if the value actually changed
                if old_val != value:
                    log = SystemSettingsLog(
                        admin_id=current_admin.id,
                        changed_field=field,
                        old_value=str(old_val) if old_val is not None else None,
                        new_value=str(value) if value is not None else None
                    )
                    db.add(log)
                    setattr(db_settings, field, value)

    # 3. Persist changes
    await db.commit()
    
    # 4. Refresh to load all DB-side defaults and timestamps for the response
    await db.refresh(db_settings)
    
    return db_settings

@router.get("/", response_model=SystemSettingsResponse, summary="Get Current System Settings")
async def get_settings(
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Any = Depends(deps.get_current_admin)
) -> Any:
    """
    Get current global system settings.
    """
    result = await db.execute(select(SystemSettings).order_by(SystemSettings.id.asc()))
    db_settings = result.scalars().first()
    
    if not db_settings:
        raise HTTPException(status_code=404, detail="System settings not found")
        
    return db_settings

@router.get("/logs", response_model=List[SystemSettingsLogResponse], summary="Get System Settings Change Logs")
async def get_settings_logs(
    db: AsyncSession = Depends(deps.get_db),
    current_admin: Any = Depends(deps.get_current_admin),
    page: int = 1,
    limit: int = 50
) -> Any:
    """
    Get recent changes to system settings.
    """
    skip = (page - 1) * limit
    result = await db.execute(
        select(SystemSettingsLog)
        .order_by(SystemSettingsLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = result.scalars().all()
    return logs
