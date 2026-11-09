from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Client, ClientStatus
from .serializers import ClientSerializer
from apps.audit.models import AuditAction, AuditModule, log_activity
from apps.audit.utils import record_create_audit, record_update_audit, record_delete_audit
from apps.accounts.permissions import IsAdministrator, IsInternalStaff


class ClientViewSet(viewsets.ModelViewSet):
    """
    CRUD for Clients with immutable audit logging and secure archival.
    """
    queryset = Client.objects.all().prefetch_related('matters')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['client_type', 'status']
    search_fields = [
        'client_reference',
        'first_name',
        'last_name',
        'organization_name',
        'contact_person',
        'email',
        'phone_number',
        'national_id',
        'registration_number',
    ]
    ordering_fields = ['created_at', 'client_reference', 'status', 'last_name', 'organization_name']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAdministrator()]
        return [IsAuthenticated(), IsInternalStaff()]

    def perform_create(self, serializer):
        client = serializer.save(created_by=self.request.user)
        record_create_audit(self.request.user, AuditModule.CLIENT, client)

    def perform_update(self, serializer):
        old_client = Client.objects.get(pk=serializer.instance.pk)
        client = serializer.save()
        record_update_audit(self.request.user, AuditModule.CLIENT, old_client, client)

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        if client.matters.exists():
            return Response(
                {'error': "Delete or reassign this client's matters first"},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        record_delete_audit(self.request.user, AuditModule.CLIENT, instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def delete_summary(self, request, pk=None):
        client = self.get_object()
        matters_count = client.matters.count()
        can_delete = (matters_count == 0)
        return Response({
            'name': client.display_name,
            'reference': client.client_reference,
            'matters_count': matters_count,
            'documents_count': client.documents.count(),
            'tasks_count': client.tasks.count(),
            'can_delete': can_delete,
            'blocked_reason': "Delete or reassign this client's matters first" if not can_delete else None,
            'message': (
                "Delete or reassign this client's matters first" if not can_delete
                else f"Are you sure you want to permanently delete client '{client.display_name}' ({client.client_reference})?"
            )
        })

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
            target_id=str(client.id),
            target_repr=f"{client.client_reference} - {client.display_name}"
        )
        return Response({'status': 'Client archived successfully.', 'client': ClientSerializer(client).data})

    @action(detail=False, methods=['get'])
    def suggest_reference(self, request):
        year = timezone.now().year
        prefix = f"CLI-{year}-"
        last_client = Client.objects.filter(client_reference__startswith=prefix).order_by('-id').first()
        if last_client and last_client.client_reference:
            try:
                last_seq = int(last_client.client_reference.split('-')[-1])
                seq = last_seq + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return Response({'suggested_reference': f"{prefix}{seq:04d}"})
