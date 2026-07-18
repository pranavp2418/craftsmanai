from fastapi import APIRouter
from .signup import router as signup_router
from .login import router as login_router
from .verify_otp import router as verify_otp_router
from .resend_otp import router as resend_otp_router
from .password_reset import router as password_reset_router
from .refresh_token import router as refresh_token_router
from .logout import router as logout_router
from .logout_all import router as logout_all_router
from .me import router as me_router

api_router = APIRouter()

# Include auth routers
api_router.include_router(signup_router, tags=["authentication"])
api_router.include_router(login_router, tags=["authentication"])
api_router.include_router(verify_otp_router, tags=["authentication"])
api_router.include_router(resend_otp_router, tags=["authentication"])
api_router.include_router(password_reset_router, tags=["authentication"])
api_router.include_router(refresh_token_router, tags=["authentication"])
api_router.include_router(logout_router, tags=["authentication"])
api_router.include_router(logout_all_router, tags=["authentication"])
api_router.include_router(me_router, tags=["authentication"])
