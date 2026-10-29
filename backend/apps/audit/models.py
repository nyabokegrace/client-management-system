from django.db import models
from django.conf import settings


class AuditAction(models.TextChoices):
    CREATE = 'CREATE', 'Created'
    UPDATE = 'UPDATE', 'Updated'
    DELETE = 'DELETE', 'Deleted'
    ARCHIVE = 'ARCHIVE', 'Archived'
    LOGIN = 'LOGIN', 'User Logged In'
    LOGOUT = 'LOGOUT', 'User Logged Out'
    DOWNLOAD = 'DOWNLOAD', 'Document Downloaded'
    STATUS_CHANGE = 'STATUS_CHANGE', 'Status Changed'
    ASSIGNMENT = 'ASSIGNMENT', 'Reassigned'


class AuditModule(models.TextChoices):
    AUTH = 'AUTH', 'Authentication'
    USER = 'USER', 'User Management'
    CLIENT = 'CLIENT', 'Client Record'
    MATTER = 'MATTER', 'Matter Record'
    DOCUMENT = 'DOCUMENT', 'Document'
    CASE_UPDATE = 'CASE_UPDATE', 'Case Progress Update'
    HEARING = 'HEARING', 'Hearing'
    TASK = 'TASK', 'Task'
    REPORT = 'REPORT', 'Report'


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_actions'
    )
    actor_name = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=50, choices=AuditAction.choices)
    module = models.CharField(max_length=50, choices=AuditModule.choices)
    target_id = models.CharField(max_length=100, blank=True)
    target_repr = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['module', '-created_at']),
            models.Index(fields=['actor', '-created_at']),
        ]

    def save(self, *args, **kwargs):
        if self.actor and not self.actor_name:
            self.actor_name = self.actor.full_name
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.actor_name or 'System'} {self.action} on {self.module} ({self.target_repr})"


def log_activity(actor, action, module, target_id='', target_repr='', details=None, ip_address=None):
    """
    Utility helper to record an immutable audit log entry.
    """
    try:
        actor_name = actor.full_name if (actor and hasattr(actor, 'full_name')) else (str(actor) if actor else 'System')
        AuditLog.objects.create(
            actor=actor if (actor and getattr(actor, 'is_authenticated', False)) else None,
            actor_name=actor_name,
            action=action,
            module=module,
            target_id=str(target_id),
            target_repr=str(target_repr)[:255],
            details=details or {},
            ip_address=ip_address,
        )
    except Exception:
        # Never break main transaction on audit log write failure
        pass
