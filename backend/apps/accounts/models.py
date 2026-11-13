import hmac
import hashlib
import uuid
import secrets
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.db import models
from django.utils import timezone


def hash_code(code: str) -> str:
    """
    Computes HMAC-SHA256 of the code using settings.SECRET_KEY.
    Codes are never stored in plain text.
    """
    key = settings.SECRET_KEY.encode('utf-8')
    return hmac.new(key, code.encode('utf-8'), hashlib.sha256).hexdigest()


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


class RecoveryCode(models.Model):
    """
    Stores single-use emergency backup recovery codes.
    Stored hashed with HMAC-SHA256, compared in constant time, and invalidated
    upon generation of a new set.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recovery_codes'
    )
    code_hash = models.CharField(max_length=64, help_text="HMAC-SHA256 hash of single-use recovery code")
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'consumed_at']),
        ]

    def __str__(self):
        status_label = 'Consumed' if self.consumed_at else 'Active'
        return f"RecoveryCode {self.id} for {self.user.username} ({status_label})"

    @classmethod
    def generate_codes_for_user(cls, user, count=8) -> list[str]:
        """
        Invalidates any existing recovery codes for the user, creates `count` new
        cryptographically random single-use recovery codes, and returns the plain
        text codes to be shown to the user once.
        """
        cls.objects.filter(user=user).delete()

        plain_codes = []
        new_objects = []
        for _ in range(count):
            part1 = secrets.token_hex(2).upper()
            part2 = secrets.token_hex(2).upper()
            code = f"{part1}-{part2}"
            plain_codes.append(code)
            new_objects.append(cls(
                user=user,
                code_hash=hash_code(code),
            ))

        cls.objects.bulk_create(new_objects)
        return plain_codes

    @classmethod
    def verify_and_consume(cls, user, candidate_code: str) -> tuple[bool, int]:
        """
        Checks if candidate_code matches an active recovery code for user.
        If match, marks it consumed and returns (True, remaining_count).
        Else returns (False, remaining_count).
        """
        active_codes = cls.objects.filter(user=user, consumed_at__isnull=True)
        cleaned_code = candidate_code.strip().upper().replace(' ', '-')
        if len(cleaned_code) == 8 and '-' not in cleaned_code:
            cleaned_code = f"{cleaned_code[:4]}-{cleaned_code[4:]}"
        target_hash = hash_code(cleaned_code)

        matching_code = active_codes.filter(code_hash=target_hash).first()
        if not matching_code:
            remaining = active_codes.count()
            return False, remaining

        matching_code.consumed_at = timezone.now()
        matching_code.save(update_fields=['consumed_at'])
        remaining = cls.objects.filter(user=user, consumed_at__isnull=True).count()
        return True, remaining
