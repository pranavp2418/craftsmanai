import logging

from app.services.auth import AuthService
from app.tasks.email_tasks import send_signup_otp_email

logger = logging.getLogger(__name__)


def generate_and_send_otp(
    db,
    user,
    otp_type: str = "email_verification",
):
    auth_service = AuthService(db)

    otp_code = auth_service.generate_and_save_otp(
        user.email,
        otp_type,
        user.id,
    )

    send_signup_otp_email.delay(
        to=user.email,
        otp=otp_code,
        user_name=user.business_name or user.email,
    )

    logger.info(
        "OTP generated and sent to %s (type=%s)",
        user.email,
        otp_type,
    )

    return otp_code