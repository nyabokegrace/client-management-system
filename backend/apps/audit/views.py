from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.accounts.permissions import IsAdministrator


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Read-only view for audit logs.
    Restricted to Administrator accounts for complete trail inspection.
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdministrator]
    filterset_fields = ['action', 'module', 'actor']
    search_fields = ['actor_name', 'target_repr', 'target_id']
    ordering_fields = ['created_at']
