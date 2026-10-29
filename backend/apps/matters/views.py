from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Matter, MatterStatus
from .serializers import MatterListSerializer, MatterDetailSerializer
from apps.audit.models import log_activity, AuditAction, AuditModule
from apps.accounts.permissions import IsInternalStaff


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

    def get_serializer_class(self):
        if self.action == 'list':
            return MatterListSerializer
        return MatterDetailSerializer

    def perform_create(self, serializer):
        matter = serializer.save(created_by=self.request.user)
        log_activity(
            actor=self.request.user,
            action=AuditAction.CREATE,
            module=AuditModule.MATTER,
            target_id=matter.id,
            target_repr=f"{matter.matter_reference} - {matter.title}",
            details={'client_id': matter.client_id, 'matter_type': matter.matter_type, 'status': matter.status}
        )

    def perform_update(self, serializer):
        matter = serializer.save()
        log_activity(
            actor=self.request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.MATTER,
            target_id=matter.id,
            target_repr=f"{matter.matter_reference} - {matter.title}",
            details={'status': matter.status, 'priority': matter.priority}
        )

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
            target_id=matter.id,
            target_repr=f"{matter.matter_reference} - {matter.title}",
            details={'from': old_status, 'to': new_status}
        )
        return Response({'status': f'Status updated to {matter.get_status_display()}', 'matter': MatterDetailSerializer(matter).data})
