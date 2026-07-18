from fastapi import APIRouter

from .accept_invitation import router as accept_invitation_router
from .invite_member import router as invite_member_router
from .list_team_members import router as list_team_members_router
from .remove_member import router as remove_member_router
from .update_member import router as update_member_router


router = APIRouter(prefix="/teams-settings", tags=["team_settings"])

router.include_router(invite_member_router)
router.include_router(accept_invitation_router)
router.include_router(list_team_members_router)
router.include_router(update_member_router)
router.include_router(remove_member_router)

