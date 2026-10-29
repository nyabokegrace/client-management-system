from django.db import models, transaction
from django.conf import settings
from django.utils import timezone


class ClientType(models.TextChoices):
    INDIVIDUAL = 'individual', 'Individual'
    ORGANIZATION = 'organization', 'Organization'


class ClientStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    INACTIVE = 'inactive', 'Inactive'
    ARCHIVED = 'archived', 'Archived'


class Client(models.Model):
    client_reference = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        help_text="Unique client reference identifier, e.g. CLI-2026-0001"
    )
    client_type = models.CharField(
        max_length=20,
        choices=ClientType.choices,
        default=ClientType.INDIVIDUAL
    )
    # Individual fields
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    national_id = models.CharField(max_length=50, blank=True, help_text="National ID or Passport Number")
    
    # Organization fields
    organization_name = models.CharField(max_length=255, blank=True)
    registration_number = models.CharField(max_length=100, blank=True, help_text="Company registration / certificate number")
    primary_contact_person = models.CharField(max_length=200, blank=True)
    
    # Contact information
    email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=50)
    alternate_phone = models.CharField(max_length=50, blank=True)
    postal_address = models.CharField(max_length=255, blank=True)
    physical_address = models.TextField(blank=True)
    
    # Assignment & internal notes
    assigned_advocate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_clients'
    )
    status = models.CharField(
        max_length=20,
        choices=ClientStatus.choices,
        default=ClientStatus.ACTIVE
    )
    internal_notes = models.TextField(blank=True)

    # Auditing
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_clients'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client_reference']),
            models.Index(fields=['status']),
            models.Index(fields=['phone_number']),
            models.Index(fields=['email']),
        ]

    @property
    def display_name(self):
        if self.client_type == ClientType.ORGANIZATION:
            return self.organization_name or 'Unnamed Organization'
        name = f"{self.first_name} {self.last_name}".strip()
        return name or 'Unnamed Individual'

    def save(self, *args, **kwargs):
        if not self.client_reference:
            with transaction.atomic():
                year = timezone.now().year
                prefix = f"CLI-{year}-"
                last_client = Client.objects.filter(client_reference__startswith=prefix).order_by('-id').first()
                if last_client and last_client.client_reference:
                    try:
                        last_seq = int(last_client.client_reference.split('-')[-1])
                        seq = last_seq + 1
                    except (ValueError, IndexError):
                        seq = 1
                else:
                    seq = 1
                self.client_reference = f"{prefix}{seq:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.client_reference} - {self.display_name}"
