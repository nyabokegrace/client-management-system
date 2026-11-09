from rest_framework import serializers
from .models import Contact, ContactType
from apps.accounts.serializers import UserSerializer


class ContactSerializer(serializers.ModelSerializer):
    contact_type_display = serializers.CharField(source='get_contact_type_display', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    matters_count = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = [
            'id',
            'name',
            'contact_type',
            'contact_type_display',
            'firm_name',
            'phone',
            'email',
            'address',
            'notes',
            'created_by',
            'created_by_details',
            'matters_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_matters_count(self, obj):
        return obj.matters.count() if hasattr(obj, 'matters') else 0
