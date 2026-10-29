from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.matters.models import Matter


class UpdateCategory(models.TextChoices):
    COURT_APPEARANCE = 'court_appearance', 'Court Appearance'
    FILING = 'filing', 'Court Filing'
    CLIENT_COMMUNICATION = 'client_comm', 'Client Communication'
    DOC_RECEIVED = 'doc_received', 'Document Received'
    DOC_SUBMITTED = 'doc_submitted', 'Document Submitted'
    NEGOTIATION = 'negotiation', 'Negotiation / Settlement'
    INTERNAL_REVIEW = 'internal_review', 'Internal Legal Review'
    GENERAL = 'general', 'General Update'


class CaseUpdate(models.Model):
    matter = models.ForeignKey(
        Matter,
        on_delete=models.CASCADE,
        related_name='case_updates'
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(
        max_length=50,
        choices=UpdateCategory.choices,
        default=UpdateCategory.GENERAL
    )
    event_datetime = models.DateTimeField(default=timezone.now)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='case_updates_authored'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-event_datetime', '-created_at']
        indexes = [
            models.Index(fields=['matter', '-event_datetime']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return f"[{self.matter.matter_reference}] {self.title}"
