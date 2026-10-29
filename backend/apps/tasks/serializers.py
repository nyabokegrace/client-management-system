from rest_framework import serializers
from .models import Task, TaskPriority, TaskStatus
from apps.accounts.serializers import UserSerializer


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    assigned_to_name = serializers.ReadOnlyField(source='assigned_to.full_name')
    created_by_name = serializers.ReadOnlyField(source='created_by.full_name')
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    matter_title = serializers.ReadOnlyField(source='matter.title')
    matter_reference = serializers.ReadOnlyField(source='matter.matter_reference')
    client_name = serializers.ReadOnlyField(source='client.display_name')
    is_overdue = serializers.ReadOnlyField()

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'client',
            'client_name',
            'matter',
            'matter_title',
            'matter_reference',
            'assigned_to',
            'assigned_to_details',
            'assigned_to_name',
            'priority',
            'priority_display',
            'status',
            'status_display',
            'due_date',
            'is_overdue',
            'completed_at',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'completed_at', 'is_overdue', 'created_at', 'updated_at']
