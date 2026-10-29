import os
from pathlib import Path
from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Document, DocumentCategory, ConfidentialityLevel, get_private_upload_path
from .serializers import DocumentSerializer
from apps.audit.models import log_activity, AuditAction, AuditModule
from apps.accounts.permissions import IsInternalStaff


class DocumentViewSet(viewsets.ModelViewSet):
    """
    Private legal document management with authorization verification and audit trails.
    """
    queryset = Document.objects.all().select_related('client', 'matter', 'uploaded_by')
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['client', 'matter', 'category', 'confidentiality']
    search_fields = ['title', 'original_filename', 'description', 'client__client_reference', 'matter__matter_reference']
    ordering_fields = ['created_at', 'title', 'file_size_bytes', 'category']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES.get('file')
        if not uploaded_file:
            raise serializers.ValidationError({'file': 'A file must be uploaded.'})

        client = serializer.validated_data['client']
        rel_storage_path = get_private_upload_path(client, uploaded_file.name)
        full_dest_path = Path(settings.PRIVATE_STORAGE_ROOT) / rel_storage_path
        full_dest_path.parent.mkdir(parents=True, exist_ok=True)

        with open(full_dest_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        doc = serializer.save(
            uploaded_by=self.request.user,
            original_filename=uploaded_file.name,
            storage_path=rel_storage_path,
            file_type=uploaded_file.content_type or 'application/octet-stream',
            file_size_bytes=uploaded_file.size,
        )

        log_activity(
            actor=self.request.user,
            action=AuditAction.CREATE,
            module=AuditModule.DOCUMENT,
            target_id=doc.id,
            target_repr=f"{doc.title} ({doc.original_filename})",
            details={'client_id': doc.client_id, 'matter_id': doc.matter_id, 'file_size': doc.file_size_bytes}
        )

    def perform_destroy(self, instance):
        # Delete file from private disk
        file_path = Path(settings.PRIVATE_STORAGE_ROOT) / instance.storage_path
        if file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                pass
        
        log_activity(
            actor=self.request.user,
            action=AuditAction.DELETE,
            module=AuditModule.DOCUMENT,
            target_id=instance.id,
            target_repr=f"{instance.title} ({instance.original_filename})"
        )
        super().perform_destroy(instance)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """
        Protected download endpoint. Verifies authorization before returning private stream.
        """
        doc = self.get_object()

        # Check confidentiality restrictions
        user = request.user
        if doc.confidentiality == ConfidentialityLevel.RESTRICTED:
            is_assigned = (doc.matter and doc.matter.assigned_advocate_id == user.id) or \
                          (doc.client and doc.client.assigned_advocate_id == user.id)
            if not user.is_administrator and not is_assigned:
                raise PermissionDenied("You do not have authorization to view or download this restricted document.")

        full_path = Path(settings.PRIVATE_STORAGE_ROOT) / doc.storage_path
        if not full_path.exists():
            raise Http404("Document file not found on private storage.")

        log_activity(
            actor=request.user,
            action=AuditAction.DOWNLOAD,
            module=AuditModule.DOCUMENT,
            target_id=doc.id,
            target_repr=f"{doc.title} ({doc.original_filename})"
        )

        response = FileResponse(
            open(full_path, 'rb'),
            content_type=doc.file_type or 'application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{doc.original_filename}"'
        return response
