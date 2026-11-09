from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Matter, MatterStatus
from .serializers import MatterListSerializer, MatterDetailSerializer
from apps.audit.models import AuditAction, AuditModule, log_activity
from apps.audit.utils import record_create_audit, record_update_audit, record_delete_audit
from apps.accounts.permissions import IsAdministrator, IsInternalStaff


class MatterViewSet(viewsets.ModelViewSet):
    """
    CRUD for Legal Matters with status tracking, assignments and audit trail.
    """
    queryset = Matter.objects.all().select_related('client', 'assigned_advocate', 'created_by').prefetch_related('supporting_staff')
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'matter_type', 'client', 'assigned_advocate']
    search_fields = [
        'matter_reference',
        'title',
        'case_number',
        'court',
        'opposing_party',
        'client__client_reference',
        'client__first_name',
        'client__last_name',
        'client__organization_name',
    ]
    ordering_fields = ['created_at', 'date_opened', 'priority', 'status', 'matter_reference']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAdministrator()]
        return [IsAuthenticated(), IsInternalStaff()]

    def get_serializer_class(self):
        if self.action == 'list':
            return MatterListSerializer
        return MatterDetailSerializer

    def perform_create(self, serializer):
        matter = serializer.save(created_by=self.request.user)
        record_create_audit(self.request.user, AuditModule.MATTER, matter)

    def perform_update(self, serializer):
        old_matter = Matter.objects.get(pk=serializer.instance.pk)
        matter = serializer.save()
        record_update_audit(self.request.user, AuditModule.MATTER, old_matter, matter)

    def perform_destroy(self, instance):
        record_delete_audit(self.request.user, AuditModule.MATTER, instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def delete_summary(self, request, pk=None):
        matter = self.get_object()
        hearings_count = matter.hearings.count()
        tasks_count = matter.tasks.count()
        case_updates_count = matter.case_updates.count()
        documents_count = matter.documents.count()
        return Response({
            'name': matter.title,
            'reference': matter.matter_reference,
            'hearings_count': hearings_count,
            'tasks_count': tasks_count,
            'case_updates_count': case_updates_count,
            'documents_count': documents_count,
            'message': (
                f"This matter has {hearings_count} hearings, {tasks_count} tasks and "
                f"{case_updates_count} case updates, which will also be deleted. "
                f"Linked documents are kept but unlinked."
            )
        })

    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        matter = self.get_object()
        new_status = request.data.get('status')
        if new_status not in MatterStatus.values:
            return Response({'error': f'Invalid status. Allowed values: {MatterStatus.values}'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = matter.status
        matter.status = new_status
        matter.save(update_fields=['status', 'updated_at'])

        log_activity(
            actor=request.user,
            action=AuditAction.STATUS_CHANGE,
            module=AuditModule.MATTER,
            target_id=str(matter.id),
            target_repr=f"{matter.matter_reference} - {matter.title}",
            details={'changes': {'status': {'old': old_status, 'new': new_status}}}
        )
        return Response({'status': f'Status updated to {matter.get_status_display()}', 'matter': MatterDetailSerializer(matter).data})
