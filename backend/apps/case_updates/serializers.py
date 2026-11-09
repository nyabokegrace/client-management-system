from rest_framework import serializers
from .models import CaseUpdate, UpdateCategory
from apps.accounts.serializers import UserSerializer
from apps.hearings.models import Hearing
from apps.tasks.models import Task


class GeneratedHearingSummarySerializer(serializers.ModelSerializer):
    hearing_type_display = serializers.CharField(source='get_hearing_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Hearing
        fields = [
            'id',
            'hearing_type',
            'hearing_type_display',
            'hearing_date',
            'court',
            'court_case_number',
            'status',
            'status_display',
        ]


class GeneratedTaskSummarySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'due_date',
            'status',
            'status_display',
            'priority',
            'priority_display',
        ]


class CaseUpdateSerializer(serializers.ModelSerializer):
    author_details = UserSerializer(source='author', read_only=True)
    author_name = serializers.ReadOnlyField(source='author.full_name')
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    matter_title = serializers.ReadOnlyField(source='matter.title')
    matter_reference = serializers.ReadOnlyField(source='matter.matter_reference')
    hearing_details = GeneratedHearingSummarySerializer(source='hearing', read_only=True)
    generated_hearings = GeneratedHearingSummarySerializer(many=True, read_only=True)
    generated_tasks = GeneratedTaskSummarySerializer(many=True, read_only=True)

    # Optional structured write fields
    next_court_date = serializers.DictField(required=False, allow_null=True, write_only=True)
    orders = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, write_only=True)
    update_linked_records = serializers.BooleanField(required=False, default=True, write_only=True)

    class Meta:
        model = CaseUpdate
        fields = [
            'id',
            'matter',
            'matter_title',
            'matter_reference',
            'hearing',
            'hearing_details',
            'title',
            'description',
            'category',
            'category_display',
            'event_datetime',
            'share_with_client',
            'author',
            'author_details',
            'author_name',
            'generated_hearings',
            'generated_tasks',
            'next_court_date',
            'orders',
            'update_linked_records',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'author', 'author_name', 'created_at', 'updated_at']

    def validate(self, attrs):
        # Automatically force share_with_client to False for internal reviews
        category = attrs.get('category') or (self.instance.category if self.instance else None)
        if category == UpdateCategory.INTERNAL_REVIEW:
            attrs['share_with_client'] = False
        return attrs
