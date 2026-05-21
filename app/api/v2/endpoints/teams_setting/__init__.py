from fastapi import APIRouter

# Teams endpoints
from .create_team import router as create_team_router
from .list_teams import router as list_teams_router
from .get_team import router as get_team_router
from .update_team import router as update_team_router
from .delete_team import router as delete_team_router

# Members endpoints
from .add_member import router as add_member_router
from .list_members import router as list_members_router
from .get_member import router as get_member_router
from .update_member_role import router as update_member_role_router
from .remove_member import router as remove_member_router

# Invitations endpoints
from .send_invitation import router as send_invitation_router
from .list_invitations import router as list_invitations_router
from .cancel_invitation import router as cancel_invitation_router
from .accept_invitation import router as accept_invitation_router
from .get_my_invitations import router as get_my_invitations_router
from .count_invitations import router as count_invitations_router

# Roles endpoints
from .create_role import router as create_role_router
from .list_roles import router as list_roles_router
from .get_default_roles import router as get_default_roles_router
from .get_role import router as get_role_router
from .update_role import router as update_role_router
from .delete_role import router as delete_role_router

router = APIRouter(prefix="/teams-settings", tags=["team-settings"])

# Include all team endpoints
router.include_router(create_team_router)
# router.include_router(list_teams_router)
# router.include_router(get_team_router)
# router.include_router(update_team_router)
router.include_router(delete_team_router)

# Include all member endpoints
router.include_router(add_member_router)
# router.include_router(list_members_router)
# router.include_router(get_member_router)
router.include_router(update_member_role_router)
router.include_router(remove_member_router)

# Include all invitation endpoints
router.include_router(send_invitation_router)
router.include_router(list_invitations_router)
# router.include_router(cancel_invitation_router)
router.include_router(accept_invitation_router)
# router.include_router(get_my_invitations_router)
router.include_router(count_invitations_router)

# Include all role endpoints
# router.include_router(create_role_router)
# router.include_router(list_roles_router)
# router.include_router(get_default_roles_router)
# router.include_router(get_role_router)
# router.include_router(update_role_router)
# router.include_router(delete_role_router)

