from django.contrib.auth.models import AbstractUser
from django.db import models


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
