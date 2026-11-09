from django.db import models
from django.conf import settings
from django.utils import timezone


class ReportMode(models.TextChoices):
    SINCE_LAST_SENT = 'since_last_sent', 'New since last sent'
    FULL_HISTORY = 'full_history', 'Full history'
    CUSTOM_RANGE = 'custom_range', 'Custom date range'


class ClientReport(models.Model):
    matter = models.ForeignKey(
        'matters.Matter',
        on_delete=models.CASCADE,
        related_name='client_reports'
    )
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='client_reports'
    )
    document = models.ForeignKey(
        'documents.Document',
        on_delete=models.CASCADE,
        related_name='client_report_record'
    )
    mode = models.CharField(
        max_length=30,
        choices=ReportMode.choices,
        default=ReportMode.FULL_HISTORY
    )
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)
    period_covered = models.CharField(max_length=255)
    generated_at = models.DateTimeField(default=timezone.now)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_client_reports'
    )
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['matter', '-generated_at']),
            models.Index(fields=['sent_at']),
        ]

    def __str__(self):
        return f"Client Report for {self.matter.matter_reference} ({self.period_covered})"
