import logging
from typing import Optional
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from app.core.config import settings

logger = logging.getLogger(__name__)


# Twilio error codes that can NEVER succeed on a retry. Retrying them does not deliver the message —
# it only multiplies the failed-message count (1 send + 3 retries = 4 failures per message, which is
# how ~60 real sends became the "240 failed outbound messages" the client reported) and hammers the
# Twilio API on the retry backoff (the "Twilio called every 2 minutes" report).
#   21211 – invalid 'To' number
#   21408 – SMS not enabled for that region (Twilio Geo Permissions — this is the India failure)
#   21606 – 'From' number is not a valid, SMS-capable sender
#   21610 – recipient replied STOP / unsubscribed
#   21612 – 'To' number unreachable from this 'From' number (e.g. US toll-free → India)
#   21614 – 'To' is not a valid mobile number
#   30003 – unreachable destination handset
#   30005 – unknown destination handset
#   30006 – landline / carrier cannot receive SMS
#   30007 – carrier violation: message filtered/blocked by the carrier (this is the US toll-free failure)
#   30032 – toll-free number not verified
PERMANENT_SMS_ERROR_CODES = {21211, 21408, 21606, 21610, 21612, 21614, 30003, 30005, 30006, 30007, 30032}


# US/Canada carriers expect a visible opt-out on every A2P message. Its ABSENCE is one of the most common
# triggers for error 30007 (message filtered / carrier violation) — which this account is hitting even
# though its toll-free number is fully VERIFIED. Twilio's Advanced Opt-Out already honours an inbound
# "STOP", so this only makes the existing behaviour visible to the recipient and the carrier.
OPT_OUT_SUFFIX = " Reply STOP to opt out."


class SMSPermanentError(Exception):
    """A Twilio failure that will NEVER succeed if retried (geo-permission off, carrier violation,
    unverified sender, invalid/unsubscribed number). Callers MUST NOT retry these — fail fast."""

    def __init__(self, code, message: str):
        self.code = code
        self.message = message
        super().__init__(f"[Twilio {code}] {message}")


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

    def send_sms(self, to_number: str, message: str, media_url: Optional[str] = None) -> bool:
        """
        Send an SMS message using Twilio.
        
        :param to_number: The recipient's phone number (E.164 format)
        :param message: The text message to send
        :return: True if the message was successfully created, False otherwise.
        """
        if not self.is_configured():
            logger.warning("Twilio SMS service is not fully configured.")
            return False

        # Append the opt-out ONLY for US/Canada (+1). Doing it here (instead of in each message string)
        # guarantees no SMS can ever go out without it. Deliberately NOT appended for other countries:
        # India's DLT rules require the delivered text to match the DLT-registered template
        # CHARACTER-FOR-CHARACTER, so appending anything to a +91 message would get it rejected.
        if (to_number or "").startswith("+1") and "stop" not in (message or "").lower():
            message = f"{message}{OPT_OUT_SUFFIX}"

        try:
            logger.info(f"Sending SMS to {to_number}...")
            # message_obj = self.client.messages.create(
            #     body=message,
            #     from_=self.from_number,
            #     to=to_number
            # )

            payload = {
                "body": message,
                "from_": self.from_number,
                "to": to_number,
            }

            if media_url:
                payload["media_url"] = [media_url]

            message_obj = self.client.messages.create(**payload)
            
            logger.info(f"SMS sent successfully. SID: {message_obj.sid}")
            return True
        except TwilioRestException as e:
            code = getattr(e, "code", None)
            msg = getattr(e, "msg", None) or str(e)
            # Surface the REAL reason. Previously this was swallowed into a bare `return False`, so the
            # task only ever raised a generic "Failed to send SMS via Twilio" and nobody could see that
            # the actual codes were 21408 (India not enabled in Geo Permissions) and 30007 (US carrier
            # violation — unverified toll-free sender).
            logger.error(
                "Twilio SMS to %s FAILED — code=%s status=%s from=%s: %s",
                to_number, code, getattr(e, "status", None), self.from_number, msg,
            )
            if code in PERMANENT_SMS_ERROR_CODES:
                # Permanent — a retry can never deliver this message. Raise a typed error so the caller
                # SKIPS its retry loop instead of burning 3 more Twilio calls per message.
                raise SMSPermanentError(code, msg)
            return False  # transient (network / 5xx / rate limit) — the caller MAY retry
        except Exception as e:
            logger.error(f"Unexpected error sending SMS to {to_number}: {e}")
            return False

sms_service = SMSService()
