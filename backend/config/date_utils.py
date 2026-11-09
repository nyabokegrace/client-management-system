"""
Date and time utilities for Africa/Nairobi timezone (UTC+3).
Used across reports, PDFs, exports, and notifications.
"""
import datetime
from zoneinfo import ZoneInfo
from django.utils import timezone

NAIROBI_TZ = ZoneInfo("Africa/Nairobi")


def to_nairobi(dt):
    """Convert any aware datetime to Africa/Nairobi, or localize naive datetime."""
    if dt is None:
        return None
    if isinstance(dt, datetime.date) and not isinstance(dt, datetime.datetime):
        return dt
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, NAIROBI_TZ)
    return dt.astimezone(NAIROBI_TZ)


def format_nairobi_datetime(dt, fallback="N/A"):
    """
    Format a datetime object as '8 Nov 2026, 4:40 pm' in Africa/Nairobi timezone.
    """
    if dt is None:
        return fallback
    dt_nairobi = to_nairobi(dt)
    day = dt_nairobi.day
    month = dt_nairobi.strftime("%b")
    year = dt_nairobi.year
    hour = dt_nairobi.strftime("%I").lstrip("0")
    minute = dt_nairobi.strftime("%M")
    ampm = dt_nairobi.strftime("%p").lower()
    return f"{day} {month} {year}, {hour}:{minute} {ampm}"


def format_nairobi_date(d, fallback="N/A"):
    """
    Format a date or datetime object as '8 Nov 2026' in Africa/Nairobi timezone.
    """
    if d is None:
        return fallback
    if isinstance(d, datetime.datetime):
        d = to_nairobi(d).date()
    day = d.day
    month = d.strftime("%b")
    year = d.year
    return f"{day} {month} {year}"
