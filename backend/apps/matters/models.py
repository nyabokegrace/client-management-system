from django.db import models, transaction
from django.conf import settings
from django.utils import timezone
from apps.clients.models import Client


class MatterStatus(models.TextChoices):
    NEW = 'new', 'New'
    ACTIVE = 'active', 'Active'
    PENDING = 'pending', 'Pending'
    AWAITING_CLIENT = 'awaiting_client', 'Awaiting Client'
    AWAITING_COURT = 'awaiting_court', 'Awaiting Court'
    CONCLUDED = 'concluded', 'Concluded'
    ARCHIVED = 'archived', 'Archived'


class MatterPriority(models.TextChoices):
    LOW = 'low', 'Low'
    NORMAL = 'normal', 'Normal'
    HIGH = 'high', 'High'
    URGENT = 'urgent', 'Urgent'


class MatterType(models.TextChoices):
    LITIGATION = 'litigation', 'Civil / Criminal Litigation'
    COMMERCIAL = 'commercial', 'Commercial & Corporate Law'
    CONVEYANCING = 'conveyancing', 'Conveyancing & Real Estate'
    FAMILY = 'family', 'Family & Succession Law'
    EMPLOYMENT = 'employment', 'Labor & Employment'
    ARBITRATION = 'arbitration', 'Arbitration & ADR'
    INTELLECTUAL_PROPERTY = 'ip', 'Intellectual Property'
    GENERAL = 'general', 'General Advisory & Practice'


class Matter(models.Model):
    matter_reference = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        help_text="Unique matter reference, e.g. SWL-2026-0001"
    )
    title = models.CharField(max_length=255)
    client = models.ForeignKey(
        Client,
        on_delete=models.PROTECT,
        related_name='matters',
        help_text="Primary client associated with this legal matter"
    )
    matter_type = models.CharField(
        max_length=50,
        choices=MatterType.choices,
        default=MatterType.LITIGATION
    )
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=30,
        choices=MatterStatus.choices,
        default=MatterStatus.NEW
    )
    priority = models.CharField(
        max_length=20,
        choices=MatterPriority.choices,
        default=MatterPriority.NORMAL
    )
    
    # Assignments
    assigned_advocate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_matters'
    )
    supporting_staff = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='supported_matters'
    )

    # Court & external details
    court = models.CharField(max_length=200, blank=True, help_text="e.g. High Court at Milimani Commercial Division")
    case_number = models.CharField(max_length=100, blank=True, help_text="Official court case registration number")
    opposing_party = models.CharField(max_length=255, blank=True)
    opposing_advocate = models.CharField(max_length=255, blank=True)

    date_opened = models.DateField(default=timezone.localdate)
    date_closed = models.DateField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_matters'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['matter_reference']),
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['client']),
            models.Index(fields=['assigned_advocate']),
            models.Index(fields=['case_number']),
        ]

    def save(self, *args, **kwargs):
        if not self.matter_reference:
            with transaction.atomic():
                year = timezone.now().year
                prefix = f"SWL-{year}-"
                last_matter = Matter.objects.filter(matter_reference__startswith=prefix).order_by('-id').first()
                if last_matter and last_matter.matter_reference:
                    try:
                        last_seq = int(last_matter.matter_reference.split('-')[-1])
                        seq = last_seq + 1
                    except (ValueError, IndexError):
                        seq = 1
                else:
                    seq = 1
                self.matter_reference = f"{prefix}{seq:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.matter_reference}: {self.title}"
