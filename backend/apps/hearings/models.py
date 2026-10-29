from django.db import models
from django.conf import settings
from apps.matters.models import Matter


class HearingType(models.TextChoices):
    MENTION = 'mention', 'Mention'
    APPLICATION = 'application', 'Hearing of Application'
    TRIAL = 'trial', 'Main Trial / Substantive Hearing'
    RULING = 'ruling', 'Ruling'
    JUDGMENT = 'judgment', 'Judgment'
    PRE_TRIAL = 'pre_trial', 'Pre-Trial Conference'
    MEDIATION = 'mediation', 'Court Annexed Mediation / ADR'
    TAXATION = 'taxation', 'Taxation of Costs'
    OTHER = 'other', 'Other Proceeding'


class HearingStatus(models.TextChoices):
    SCHEDULED = 'scheduled', 'Scheduled'
    COMPLETED = 'completed', 'Completed'
    ADJOURNED = 'adjourned', 'Adjourned'
    CANCELLED = 'cancelled', 'Cancelled'


class Hearing(models.Model):
    matter = models.ForeignKey(
        Matter,
        on_delete=models.CASCADE,
        related_name='hearings'
    )
    hearing_type = models.CharField(
        max_length=50,
        choices=HearingType.choices,
        default=HearingType.MENTION
    )
    hearing_date = models.DateTimeField(
        help_text="Scheduled hearing date and time in Nairobi local time"
    )
    court = models.CharField(max_length=200, blank=True)
    court_case_number = models.CharField(max_length=100, blank=True)
    location_details = models.CharField(
        max_length=255,
        blank=True,
        help_text="Courtroom, registry or virtual meeting link"
    )
    assigned_advocate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_hearings'
    )
    status = models.CharField(
        max_length=30,
        choices=HearingStatus.choices,
        default=HearingStatus.SCHEDULED
    )
    notes = models.TextField(blank=True, help_text="Preparation notes, instructions or reminders")
    outcome_summary = models.TextField(blank=True, help_text="Proceedings record, directions issued, or orders made")
    next_hearing_date = models.DateTimeField(null=True, blank=True, help_text="Next date set by the court")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_hearings'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['hearing_date']
        indexes = [
            models.Index(fields=['hearing_date']),
            models.Index(fields=['status']),
            models.Index(fields=['matter', 'hearing_date']),
            models.Index(fields=['assigned_advocate', 'hearing_date']),
        ]

    def save(self, *args, **kwargs):
        # Default court and case number from matter if not explicitly provided
        if not self.court and self.matter:
            self.court = self.matter.court
        if not self.court_case_number and self.matter:
            self.court_case_number = self.matter.case_number
        if not self.assigned_advocate and self.matter:
            self.assigned_advocate = self.matter.assigned_advocate
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_hearing_type_display()} on {self.hearing_date:%Y-%m-%d %H:%M} ({self.matter.matter_reference})"
