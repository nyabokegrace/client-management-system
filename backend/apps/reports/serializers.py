from rest_framework import serializers
from .models import ClientReport
from config.date_utils import format_nairobi_datetime, format_nairobi_date


class ClientReportSerializer(serializers.ModelSerializer):
    document_title = serializers.ReadOnlyField(source='document.title')
    document_filename = serializers.ReadOnlyField(source='document.original_filename')
    document_size_display = serializers.ReadOnlyField(source='document.file_size_display')
    generated_by_name = serializers.ReadOnlyField(source='generated_by.full_name')
    mode_display = serializers.CharField(source='get_mode_display', read_only=True)
    generated_at_display = serializers.SerializerMethodField()
    sent_at_display = serializers.SerializerMethodField()

    class Meta:
        model = ClientReport
        fields = [
            'id',
            'matter',
            'client',
            'document',
            'document_title',
            'document_filename',
            'document_size_display',
            'mode',
            'mode_display',
            'period_start',
            'period_end',
            'period_covered',
            'update_ids',
            'generated_at',
            'generated_at_display',
            'generated_by',
            'generated_by_name',
            'sent_at',
            'sent_at_display',
        ]
        read_only_fields = ['id', 'document', 'generated_at', 'generated_by']

    def get_generated_at_display(self, obj):
        return format_nairobi_datetime(obj.generated_at)

    def get_sent_at_display(self, obj):
        return format_nairobi_datetime(obj.sent_at) if obj.sent_at else None
