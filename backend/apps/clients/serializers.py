from rest_framework import serializers
from .models import Client, ClientType, ClientStatus
from apps.accounts.serializers import UserSerializer


class ClientSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()
    assigned_advocate_details = UserSerializer(source='assigned_advocate', read_only=True)
    created_by_name = serializers.ReadOnlyField(source='created_by.full_name')
    matters_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id',
            'client_reference',
            'client_type',
            'display_name',
            'first_name',
            'last_name',
            'national_id',
            'organization_name',
            'registration_number',
            'primary_contact_person',
            'email',
            'phone_number',
            'alternate_phone',
            'postal_address',
            'physical_address',
            'assigned_advocate',
            'assigned_advocate_details',
            'status',
            'internal_notes',
            'created_by',
            'created_by_name',
            'matters_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'client_reference', 'created_by', 'created_at', 'updated_at', 'display_name']

    def get_matters_count(self, obj):
        return getattr(obj, 'matters', None).count() if hasattr(obj, 'matters') else 0

    def validate(self, attrs):
        client_type = attrs.get('client_type', self.instance.client_type if self.instance else ClientType.INDIVIDUAL)
        if client_type == ClientType.ORGANIZATION:
            if not attrs.get('organization_name') and not (self.instance and self.instance.organization_name):
                raise serializers.ValidationError({'organization_name': 'Organization name is required for organization clients.'})
        else:
            if not attrs.get('first_name') and not (self.instance and self.instance.first_name):
                raise serializers.ValidationError({'first_name': 'First name is required for individual clients.'})
        return attrs
