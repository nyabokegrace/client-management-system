from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Client, ClientStatus
from .serializers import ClientSerializer
from apps.audit.models import log_activity, AuditAction, AuditModule
from apps.accounts.permissions import IsInternalStaff


class ClientViewSet(viewsets.ModelViewSet):
    """
    CRUD endpoints for Client records with full search, filtering and audit trails.
    """
    queryset = Client.objects.all().select_related('assigned_advocate', 'created_by')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['client_type', 'status', 'assigned_advocate']
    search_fields = [
        'client_reference',
        'first_name',
        'last_name',
        'organization_name',
        'email',
        'phone_number',
        'national_id',
        'registration_number',
    ]
    ordering_fields = ['created_at', 'client_reference', 'status', 'last_name', 'organization_name']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        client = serializer.save(created_by=self.request.user)
        log_activity(
            actor=self.request.user,
            action=AuditAction.CREATE,
            module=AuditModule.CLIENT,
            target_id=client.id,
            target_repr=f"{client.client_reference} - {client.display_name}",
            details={'client_type': client.client_type, 'phone': client.phone_number}
        )

    def perform_update(self, serializer):
        client = serializer.save()
        log_activity(
            actor=self.request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.CLIENT,
            target_id=client.id,
            target_repr=f"{client.client_reference} - {client.display_name}",
            details={'status': client.status}
        )

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """
        Controlled archival of client record preserving all historical legal records.
        """
        client = self.get_object()
        client.status = ClientStatus.ARCHIVED
        client.save(update_fields=['status', 'updated_at'])
        log_activity(
            actor=request.user,
            action=AuditAction.ARCHIVE,
            module=AuditModule.CLIENT,
            target_id=client.id,
            target_repr=f"{client.client_reference} - {client.display_name}"
        )
        return Response({'status': 'Client archived successfully.', 'client': ClientSerializer(client).data})
