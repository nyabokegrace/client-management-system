from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import CaseUpdate
from .serializers import CaseUpdateSerializer
from apps.audit.models import log_activity, AuditAction, AuditModule
from apps.accounts.permissions import IsInternalStaff


class CaseUpdateViewSet(viewsets.ModelViewSet):
    """
    Chronological progress updates for legal matters.
    """
    queryset = CaseUpdate.objects.all().select_related('matter', 'author')
    serializer_class = CaseUpdateSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['matter', 'category', 'author']
    search_fields = ['title', 'description', 'matter__matter_reference', 'matter__title']
    ordering_fields = ['event_datetime', 'created_at']
    ordering = ['-event_datetime']

    def perform_create(self, serializer):
        update = serializer.save(author=self.request.user)
        log_activity(
            actor=self.request.user,
            action=AuditAction.CREATE,
            module=AuditModule.CASE_UPDATE,
            target_id=update.id,
            target_repr=f"Update on {update.matter.matter_reference}: {update.title}",
            details={'matter_id': update.matter_id, 'category': update.category}
        )

    def perform_update(self, serializer):
        update = serializer.save()
        log_activity(
            actor=self.request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.CASE_UPDATE,
            target_id=update.id,
            target_repr=f"Update on {update.matter.matter_reference}: {update.title}"
        )
