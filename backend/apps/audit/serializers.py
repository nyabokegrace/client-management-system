from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    module_display = serializers.CharField(source='get_module_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'actor',
            'actor_name',
            'action',
            'action_display',
            'module',
            'module_display',
            'target_id',
            'target_repr',
            'details',
            'ip_address',
            'created_at',
        ]
        read_only_fields = fields
