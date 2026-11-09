from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Contact
from .serializers import ContactSerializer
from apps.audit.models import AuditModule
from apps.audit.utils import record_create_audit, record_update_audit, record_delete_audit
from apps.accounts.permissions import IsAdministrator, IsInternalStaff


class ContactViewSet(viewsets.ModelViewSet):
    """
    CRUD management for external contacts, advocates, law firms and opposing counsel.
    Follows identical permission and audit rules as clients.
    """
    queryset = Contact.objects.all().prefetch_related('matters')
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['contact_type']
    search_fields = ['name', 'firm_name', 'phone', 'email', 'address', 'notes']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAdministrator()]
        return [IsAuthenticated(), IsInternalStaff()]

    def perform_create(self, serializer):
        contact = serializer.save(created_by=self.request.user)
        record_create_audit(self.request.user, AuditModule.CONTACT, contact)

    def perform_update(self, serializer):
        old_contact = Contact.objects.get(pk=serializer.instance.pk)
        contact = serializer.save()
        record_update_audit(self.request.user, AuditModule.CONTACT, old_contact, contact)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        matters_count = instance.matters.count()
        if matters_count > 0:
            return Response(
                {
                    'error': 'This contact is linked to one or more matters as opposing counsel and cannot be deleted.',
                    'matters_count': matters_count,
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        record_delete_audit(self.request.user, AuditModule.CONTACT, instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def delete_summary(self, request, pk=None):
        contact = self.get_object()
        matters_count = contact.matters.count()
        type_str = contact.firm_name if (contact.firm_name and contact.contact_type == 'advocate') else contact.get_contact_type_display()

        if matters_count > 0:
            return Response({
                'name': contact.name,
                'reference': type_str,
                'matters_count': matters_count,
                'blocked': True,
                'blocked_reason': 'This contact is linked to one or more matters as opposing counsel and cannot be deleted.',
                'message': f"Cannot delete '{contact.name}'. It is attached to {matters_count} legal matter(s) as opposing counsel. Remove or reassign the link on those matters first."
            })

        return Response({
            'name': contact.name,
            'reference': type_str,
            'matters_count': 0,
            'blocked': False,
            'blocked_reason': None,
            'message': f"Are you sure you want to permanently delete contact '{contact.name}'? This action cannot be undone."
        })
