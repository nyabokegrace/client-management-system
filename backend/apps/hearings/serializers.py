from rest_framework import serializers
from .models import Hearing, HearingType, HearingStatus
from apps.accounts.serializers import UserSerializer


class HearingSerializer(serializers.ModelSerializer):
    assigned_advocate_details = UserSerializer(source='assigned_advocate', read_only=True)
    assigned_advocate_name = serializers.ReadOnlyField(source='assigned_advocate.full_name')
    hearing_type_display = serializers.CharField(source='get_hearing_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    matter_title = serializers.ReadOnlyField(source='matter.title')
    matter_reference = serializers.ReadOnlyField(source='matter.matter_reference')
    client_name = serializers.ReadOnlyField(source='matter.client.display_name')

    class Meta:
        model = Hearing
        fields = [
            'id',
            'matter',
            'matter_title',
            'matter_reference',
            'client_name',
            'hearing_type',
            'hearing_type_display',
            'hearing_date',
            'court',
            'court_case_number',
            'location_details',
            'assigned_advocate',
            'assigned_advocate_details',
            'assigned_advocate_name',
            'status',
            'status_display',
            'notes',
            'outcome_summary',
            'next_hearing_date',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
