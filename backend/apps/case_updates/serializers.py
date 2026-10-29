from rest_framework import serializers
from .models import CaseUpdate, UpdateCategory
from apps.accounts.serializers import UserSerializer


class CaseUpdateSerializer(serializers.ModelSerializer):
    author_details = UserSerializer(source='author', read_only=True)
    author_name = serializers.ReadOnlyField(source='author.full_name')
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    matter_title = serializers.ReadOnlyField(source='matter.title')
    matter_reference = serializers.ReadOnlyField(source='matter.matter_reference')

    class Meta:
        model = CaseUpdate
        fields = [
            'id',
            'matter',
            'matter_title',
            'matter_reference',
            'title',
            'description',
            'category',
            'category_display',
            'event_datetime',
            'author',
            'author_details',
            'author_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'author', 'author_name', 'created_at', 'updated_at']
