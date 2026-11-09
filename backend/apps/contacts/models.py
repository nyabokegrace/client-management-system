from django.db import models
from django.conf import settings


class ContactType(models.TextChoices):
    ADVOCATE = 'advocate', 'Advocate'
    LAW_FIRM = 'law_firm', 'Law Firm'
    OTHER = 'other', 'Other'


class Contact(models.Model):
    name = models.CharField(max_length=255, help_text="Full name of contact, advocate, or institution")
    contact_type = models.CharField(
        max_length=20,
        choices=ContactType.choices,
        default=ContactType.ADVOCATE
    )
    firm_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Law firm name (for advocates)"
    )
    phone = models.CharField(max_length=50, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    address = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_contacts'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['contact_type']),
            models.Index(fields=['email']),
        ]

    def __str__(self):
        if self.firm_name and self.contact_type == ContactType.ADVOCATE:
            return f"{self.name} ({self.firm_name})"
        return self.name
