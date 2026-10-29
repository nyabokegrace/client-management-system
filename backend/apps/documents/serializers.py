import os
from rest_framework import serializers
from django.conf import settings
from .models import Document, DocumentCategory, ConfidentialityLevel
from apps.accounts.serializers import UserSerializer


ALLOWED_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt',
    '.xls', '.xlsx', '.csv',
    '.png', '.jpg', '.jpeg', '.webp', '.tiff',
    '.zip'
}


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_details = UserSerializer(source='uploaded_by', read_only=True)
    file_size_display = serializers.ReadOnlyField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    confidentiality_display = serializers.CharField(source='get_confidentiality_display', read_only=True)
    client_name = serializers.ReadOnlyField(source='client.display_name')
    matter_title = serializers.ReadOnlyField(source='matter.title')
    matter_reference = serializers.ReadOnlyField(source='matter.matter_reference')

    # Upload file parameter (write-only)
    file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = Document
        fields = [
            'id',
            'title',
            'category',
            'category_display',
            'confidentiality',
            'confidentiality_display',
            'client',
            'client_name',
            'matter',
            'matter_title',
            'matter_reference',
            'original_filename',
            'file_type',
            'file_size_bytes',
            'file_size_display',
            'description',
            'uploaded_by',
            'uploaded_by_details',
            'file',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'original_filename',
            'file_type',
            'file_size_bytes',
            'file_size_display',
            'uploaded_by',
            'created_at',
            'updated_at',
        ]

    def create(self, validated_data):
        validated_data.pop('file', None)
        return super().create(validated_data)

    def validate_file(self, value):
        if not value:
            return value
        
        # Check file size limit
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if value.size > max_bytes:
            raise serializers.ValidationError(f"File size exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB limit.")
        
        # Check file extension
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(f"File type '{ext}' is not permitted. Permitted types: PDF, DOC, DOCX, TXT, XLS, XLSX, CSV, images, and ZIP.")
        
        return value
