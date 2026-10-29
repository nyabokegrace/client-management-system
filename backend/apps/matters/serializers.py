from rest_framework import serializers
from .models import Matter, MatterStatus, MatterPriority, MatterType
from apps.accounts.serializers import UserSerializer
from apps.clients.serializers import ClientSerializer


class MatterListSerializer(serializers.ModelSerializer):
    client_name = serializers.ReadOnlyField(source='client.display_name')
    client_reference = serializers.ReadOnlyField(source='client.client_reference')
    assigned_advocate_name = serializers.ReadOnlyField(source='assigned_advocate.full_name')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    matter_type_display = serializers.CharField(source='get_matter_type_display', read_only=True)

    class Meta:
        model = Matter
        fields = [
            'id',
            'matter_reference',
            'title',
            'client',
            'client_name',
            'client_reference',
            'matter_type',
            'matter_type_display',
            'status',
            'status_display',
            'priority',
            'priority_display',
            'assigned_advocate',
            'assigned_advocate_name',
            'court',
            'case_number',
            'date_opened',
            'created_at',
            'updated_at',
        ]


class MatterDetailSerializer(serializers.ModelSerializer):
    client_details = ClientSerializer(source='client', read_only=True)
    assigned_advocate_details = UserSerializer(source='assigned_advocate', read_only=True)
    supporting_staff_details = UserSerializer(source='supporting_staff', many=True, read_only=True)
    created_by_name = serializers.ReadOnlyField(source='created_by.full_name')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    matter_type_display = serializers.CharField(source='get_matter_type_display', read_only=True)
    
    # Summary counts
    updates_count = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()
    hearings_count = serializers.SerializerMethodField()
    tasks_count = serializers.SerializerMethodField()

    class Meta:
        model = Matter
        fields = [
            'id',
            'matter_reference',
            'title',
            'client',
            'client_details',
            'matter_type',
            'matter_type_display',
            'description',
            'status',
            'status_display',
            'priority',
            'priority_display',
            'assigned_advocate',
            'assigned_advocate_details',
            'supporting_staff',
            'supporting_staff_details',
            'court',
            'case_number',
            'opposing_party',
            'opposing_advocate',
            'date_opened',
            'date_closed',
            'internal_notes',
            'created_by',
            'created_by_name',
            'updates_count',
            'documents_count',
            'hearings_count',
            'tasks_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'matter_reference', 'created_by', 'created_at', 'updated_at']

    def get_updates_count(self, obj):
        return getattr(obj, 'case_updates', None).count() if hasattr(obj, 'case_updates') else 0

    def get_documents_count(self, obj):
        return getattr(obj, 'documents', None).count() if hasattr(obj, 'documents') else 0

    def get_hearings_count(self, obj):
        return getattr(obj, 'hearings', None).count() if hasattr(obj, 'hearings') else 0

    def get_tasks_count(self, obj):
        return getattr(obj, 'tasks', None).count() if hasattr(obj, 'tasks') else 0
