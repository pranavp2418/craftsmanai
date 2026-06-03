import logging
from typing import Optional
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from app.core.config import settings

logger = logging.getLogger(__name__)

class SMSService:
    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.from_number = settings.TWILIO_PHONE_NUMBER
        self.client = None
        
        if self.account_sid and self.auth_token:
            try:
                self.client = Client(self.account_sid, self.auth_token)
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")

    def is_configured(self) -> bool:
        return bool(self.client and self.from_number)

    def send_sms(self, to_number: str, message: str) -> bool:
        """
        Send an SMS message using Twilio.
        
        :param to_number: The recipient's phone number (E.164 format)
        :param message: The text message to send
        :return: True if the message was successfully created, False otherwise.
        """
        if not self.is_configured():
            logger.warning("Twilio SMS service is not fully configured.")
            return False

        try:
            logger.info(f"Sending SMS to {to_number}...")
            message_obj = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=to_number
            )
            logger.info(f"SMS sent successfully. SID: {message_obj.sid}")
            return True
        except TwilioRestException as e:
            logger.error(f"Twilio API error sending SMS to {to_number}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending SMS to {to_number}: {e}")
            return False

sms_service = SMSService()
