from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import CaseUpdate
from .serializers import CaseUpdateSerializer
from apps.audit.models import AuditAction, AuditModule, log_activity
from apps.audit.utils import record_create_audit, record_update_audit, record_delete_audit
from apps.accounts.permissions import IsAdministrator, IsInternalStaff


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

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAdministrator()]
        return [IsAuthenticated(), IsInternalStaff()]

    def perform_create(self, serializer):
        update = serializer.save(author=self.request.user)
        record_create_audit(self.request.user, AuditModule.CASE_UPDATE, update)

    def perform_update(self, serializer):
        old_update = CaseUpdate.objects.get(pk=serializer.instance.pk)
        update = serializer.save()
        record_update_audit(self.request.user, AuditModule.CASE_UPDATE, old_update, update)

    def perform_destroy(self, instance):
        record_delete_audit(self.request.user, AuditModule.CASE_UPDATE, instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def delete_summary(self, request, pk=None):
        update = self.get_object()
        ref = update.matter.matter_reference if update.matter else ''
        return Response({
            'name': update.title,
            'reference': ref,
            'message': f"Are you sure you want to delete case update '{update.title}'? This action cannot be undone."
        })
