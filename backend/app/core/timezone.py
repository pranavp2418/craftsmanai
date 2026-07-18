import pytz
from datetime import datetime

CST_TZ = pytz.timezone("America/Chicago")


def now() -> datetime:
    """Return current datetime in US Central Time."""
    return datetime.now(CST_TZ)
