import uuid
from datetime import timedelta
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models
from django.utils import timezone
from .emails import (
    hash_code,
    verify_code_hash,
    generate_six_digit_code,
    send_verification_email,
    check_hourly_email_limit,
)


class UserRole(models.TextChoices):
    ADMIN = 'admin', 'Administrator'
    ADVOCATE = 'advocate', 'Advocate'
    STAFF = 'staff', 'Authorized Staff'


class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STAFF,
        help_text="Determines authorization level and permissions within the system."
    )
    phone_number = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['first_name', 'last_name', 'username']

    @property
    def is_administrator(self):
        return self.role == UserRole.ADMIN or self.is_superuser

    @property
    def is_advocate(self):
        return self.role == UserRole.ADVOCATE

    @property
    def is_support_staff(self):
        return self.role == UserRole.STAFF

    @property
    def full_name(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name if name else self.username

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()})"


class ChallengePurpose(models.TextChoices):
    LOGIN = 'login', 'Login'
    RESET = 'reset', 'Password Reset'
    SETUP = 'setup', 'Initial Setup'
    EMAIL_CHANGE = 'email_change', 'Email Change'


class LoginChallenge(models.Model):
    """
    Tracks one-time verification challenges for email 2FA, password reset,
    first-time administrator setup, and email updates.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='login_challenges'
    )
    purpose = models.CharField(
        max_length=20,
        choices=ChallengePurpose.choices,
        default=ChallengePurpose.LOGIN
    )
    target_email = models.EmailField()
    code_hash = models.CharField(max_length=64, help_text="HMAC-SHA256 hash of the 6-digit code")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=1)
    last_sent_at = models.DateTimeField(default=timezone.now)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['target_email', 'purpose', '-created_at']),
            models.Index(fields=['expires_at', 'consumed_at']),
        ]

    def __str__(self):
        return f"Challenge {self.id} [{self.purpose}] for {self.target_email}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    @property
    def is_locked(self) -> bool:
        return self.attempts >= 5

    @property
    def is_valid(self) -> bool:
        return not self.is_consumed and not self.is_expired and not self.is_locked

    @property
    def seconds_until_expiry(self) -> int:
        return max(0, int((self.expires_at - timezone.now()).total_seconds()))

    @property
    def seconds_until_resend(self) -> int:
        elapsed = (timezone.now() - self.last_sent_at).total_seconds()
        return max(0, int(60 - elapsed))

    @classmethod
    def create_challenge(cls, user=None, target_email=None, purpose=ChallengePurpose.LOGIN, ttl_minutes=None):
        """
        Creates a new verification challenge, generates a 6-digit code, hashes it,
        and dispatches the notification email.
        Returns (challenge, plain_code, send_success, send_error_message).
        """
        if not target_email and user:
            target_email = user.email

        if not target_email:
            raise ValueError("Target email is required to create a verification challenge.")

        target_email = target_email.strip()

        if ttl_minutes is None:
            ttl_minutes = getattr(settings, 'CHALLENGE_TTL_MINUTES', 10)

        # Enforce hourly cap before creating
        if not check_hourly_email_limit(target_email):
            return None, None, False, "Email limit reached for this hour. Please try again later."

        code = generate_six_digit_code()
        hashed = hash_code(code)
        now = timezone.now()
        expires = now + timedelta(minutes=ttl_minutes)

        challenge = cls.objects.create(
            user=user,
            purpose=purpose,
            target_email=target_email,
            code_hash=hashed,
            expires_at=expires,
            last_sent_at=now,
            sent_count=1,
            attempts=0,
        )

        sent_ok, send_msg = send_verification_email(
            target_email=target_email,
            code=code,
            purpose=purpose,
            ttl_minutes=ttl_minutes
        )

        return challenge, code, sent_ok, send_msg

    def can_resend(self) -> tuple[bool, str]:
        if self.is_consumed or self.is_locked:
            return False, "This verification challenge is no longer active."
        if self.seconds_until_resend > 0:
            return False, f"Please wait {self.seconds_until_resend} seconds before requesting a new code."
        if self.sent_count >= 5:
            return False, "Maximum verification code resends reached for this request."
        if not check_hourly_email_limit(self.target_email):
            return False, "Email limit reached for this hour. Please try again later."
        return True, ""

    def resend(self, ttl_minutes=None) -> tuple[bool, str, str]:
        """
        Replaces the verification code, enforces cooldown and limits, and emails the new code.
        Returns (success: bool, error_msg: str, new_code: str).
        """
        allowed, reason = self.can_resend()
        if not allowed:
            return False, reason, ""

        if ttl_minutes is None:
            ttl_minutes = getattr(settings, 'CHALLENGE_TTL_MINUTES', 10)

        new_code = generate_six_digit_code()
        now = timezone.now()

        self.code_hash = hash_code(new_code)
        self.sent_count += 1
        self.last_sent_at = now
        # Refresh expiration window on new code send
        self.expires_at = now + timedelta(minutes=ttl_minutes)
        self.save(update_fields=['code_hash', 'sent_count', 'last_sent_at', 'expires_at'])

        sent_ok, send_msg = send_verification_email(
            target_email=self.target_email,
            code=new_code,
            purpose=self.purpose,
            ttl_minutes=ttl_minutes
        )

        if not sent_ok:
            return False, send_msg, new_code

        return True, "", new_code

    def verify(self, candidate_code: str) -> tuple[bool, str]:
        """
        Verifies the candidate code against the stored hash.
        Tracks attempts and marks consumed on success.
        Returns (success: bool, error_message: str).
        """
        if self.is_consumed:
            return False, "This verification code has already been used."
        if self.is_locked:
            return False, "Verification locked due to too many failed attempts."
        if self.is_expired:
            return False, "This verification code has expired. Please request a new code."

        self.attempts += 1

        if not verify_code_hash(candidate_code, self.code_hash):
            self.save(update_fields=['attempts'])
            if self.attempts >= 5:
                return False, "Verification locked due to too many failed attempts."
            remaining = 5 - self.attempts
            return False, f"Invalid verification code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."

        self.consumed_at = timezone.now()
        self.save(update_fields=['attempts', 'consumed_at'])
        return True, ""
