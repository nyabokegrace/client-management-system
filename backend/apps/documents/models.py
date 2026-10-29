import os
import uuid
from django.db import models
from django.conf import settings
from apps.clients.models import Client
from apps.matters.models import Matter


class DocumentCategory(models.TextChoices):
    PLEADINGS = 'pleadings', 'Pleadings & Court Submissions'
    EVIDENCE = 'evidence', 'Evidence & Exhibits'
    CORRESPONDENCE = 'correspondence', 'Correspondence'
    CONTRACTS = 'contracts', 'Contracts & Agreements'
    CORPORATE = 'corporate', 'Statutory & Corporate Documents'
    FINANCIAL = 'financial', 'Billing, Invoices & Receipts'
    GENERAL = 'general', 'General Legal Document'


class ConfidentialityLevel(models.TextChoices):
    STANDARD = 'standard', 'Standard Internal'
    HIGHLY_CONFIDENTIAL = 'confidential', 'Highly Confidential'
    RESTRICTED = 'restricted', 'Restricted to Assigned Advocate'


def get_private_upload_path(instance_or_client, filename):
    # Generates a non-guessable, path-traversal immune storage name
    client_id = getattr(instance_or_client, 'client_id', getattr(instance_or_client, 'id', 'general'))
    ext = os.path.splitext(filename)[1].lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"
    return os.path.join(str(client_id), safe_name)


class Document(models.Model):
    title = models.CharField(max_length=255)
    category = models.CharField(
        max_length=50,
        choices=DocumentCategory.choices,
        default=DocumentCategory.GENERAL
    )
    confidentiality = models.CharField(
        max_length=50,
        choices=ConfidentialityLevel.choices,
        default=ConfidentialityLevel.STANDARD
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name='documents',
        help_text="Client to which this legal document belongs"
    )
    matter = models.ForeignKey(
        Matter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documents',
        help_text="Optional specific legal matter"
    )
    
    # File metadata
    original_filename = models.CharField(max_length=255)
    storage_path = models.CharField(
        max_length=500,
        help_text="Relative path inside the private document storage root"
    )
    file_type = models.CharField(max_length=100, blank=True)
    file_size_bytes = models.BigIntegerField(default=0)
    description = models.TextField(blank=True)
    
    # Audit info
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_documents'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', '-created_at']),
            models.Index(fields=['matter', '-created_at']),
            models.Index(fields=['category']),
        ]

    @property
    def file_size_display(self):
        bytes_val = self.file_size_bytes
        if bytes_val < 1024:
            return f"{bytes_val} B"
        elif bytes_val < 1024 * 1024:
            return f"{bytes_val / 1024:.1f} KB"
        else:
            return f"{bytes_val / (1024 * 1024):.1f} MB"

    def __str__(self):
        return f"{self.title} ({self.original_filename})"
