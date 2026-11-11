import hmac
import hashlib
import logging
import secrets
from datetime import timedelta
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.db import models

logger = logging.getLogger(__name__)

MAX_EMAILS_PER_HOUR = 10


def generate_six_digit_code() -> str:
    """
    Generates a cryptographically secure 6-digit numeric verification code.
    Always formatted as 6 digits with leading zeros if necessary.
    """
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str) -> str:
    """
    Computes HMAC-SHA256 of the verification code using settings.SECRET_KEY.
    Codes are never stored in plain text.
    """
    key = settings.SECRET_KEY.encode('utf-8')
    return hmac.new(key, code.encode('utf-8'), hashlib.sha256).hexdigest()


def verify_code_hash(candidate_code: str, expected_hash: str) -> bool:
    """
    Constant-time comparison between candidate code hash and stored HMAC-SHA256 hash.
    """
    computed = hash_code(candidate_code.strip())
    return hmac.compare_digest(computed, expected_hash)


def mask_email(email: str) -> str:
    """
    Masks an email address for safe display, e.g. info@siwoloadvocates.com -> i***@siwoloadvocates.com
    """
    if not email or '@' not in email:
        return email or ''
    user_part, domain_part = email.split('@', 1)
    if len(user_part) <= 1:
        masked_user = user_part + '***'
    else:
        masked_user = user_part[0] + '***'
    return f"{masked_user}@{domain_part}"


def check_hourly_email_limit(target_email: str, max_per_hour: int = MAX_EMAILS_PER_HOUR) -> bool:
    """
    Checks if the hourly email limit for this target email has been reached.
    Returns True if allowed to send, False if capped.
    """
    from .models import LoginChallenge
    one_hour_ago = timezone.now() - timedelta(hours=1)
    challenges = LoginChallenge.objects.filter(
        target_email__iexact=target_email.strip(),
        last_sent_at__gte=one_hour_ago
    )
    total_sent = challenges.aggregate(total=models.Sum('sent_count'))['total'] or 0
    return total_sent < max_per_hour


def send_verification_email(target_email: str, code: str, purpose: str = 'login', ttl_minutes: int = 10) -> tuple[bool, str]:
    """
    Sends the 6-digit verification code using Django's built-in email framework.
    Uses plain text with a short HTML alternative.
    Contains no links.
    Returns (success: bool, message: str).
    """
    subject = "Your Siwolo CMS verification code"

    purpose_labels = {
        'login': 'two-factor sign-in',
        'reset': 'password reset',
        'setup': 'initial administrator setup',
        'email_change': 'email address update',
    }
    purpose_desc = purpose_labels.get(purpose, 'verification')

    text_content = (
        f"Your Siwolo CMS verification code is: {code}\n\n"
        f"This code is requested for your {purpose_desc} and will expire in {ttl_minutes} minutes.\n\n"
        "If you did not request this verification code, please ignore this email or contact your administrator immediately. "
        "Do not share this code with anyone.\n"
    )

    html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111111; background-color: #f3f4f6; padding: 24px; margin: 0;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 4px; padding: 32px;">
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #111111; letter-spacing: 0.5px;">Siwolo P.O Law Advocates</h2>
      <p style="margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280;">Client &amp; Case Management System</p>
    </div>
    <p style="font-size: 14px; color: #374151; margin-bottom: 8px;">
      Use the verification code below for your {purpose_desc}:
    </p>
    <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 16px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111111; font-family: monospace;">{code}</span>
    </div>
    <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0;">
      This code will expire in <strong>{ttl_minutes} minutes</strong>.
    </p>
    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
      <p style="font-size: 11px; color: #9ca3af; margin: 0; line-height: 1.4;">
        If you did not request this verification code, please ignore this email. Do not share this code with anyone.
      </p>
    </div>
  </div>
</body>
</html>
"""

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'info@siwoloadvocates.com')

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[target_email.strip()],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        return True, ""
    except Exception as e:
        logger.error(
            "Failed to deliver verification email to %s for purpose %s: %s",
            target_email,
            purpose,
            str(e),
            exc_info=True
        )
        return False, "We could not send the email, try again"
