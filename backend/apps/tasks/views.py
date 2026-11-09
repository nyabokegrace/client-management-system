from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Task, TaskStatus
from .serializers import TaskSerializer
from apps.audit.models import AuditAction, AuditModule, log_activity
from apps.audit.utils import record_create_audit, record_update_audit, record_delete_audit
from apps.accounts.permissions import IsAdministrator, IsInternalStaff


class TaskViewSet(viewsets.ModelViewSet):
    """
    Task assignments, due dates, priority management and completions.
    """
    queryset = Task.objects.all().select_related('client', 'matter', 'assigned_to', 'created_by')
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to', 'matter', 'client']
    search_fields = [
        'title',
        'description',
        'matter__matter_reference',
        'matter__title',
        'client__first_name',
        'client__last_name',
        'client__organization_name',
    ]
    ordering_fields = ['due_date', 'priority', 'created_at', 'status']
    ordering = ['due_date', '-priority']

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAdministrator()]
        return [IsAuthenticated(), IsInternalStaff()]

    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        record_create_audit(self.request.user, AuditModule.TASK, task)

    def perform_update(self, serializer):
        old_task = Task.objects.get(pk=serializer.instance.pk)
        task = serializer.save()
        record_update_audit(self.request.user, AuditModule.TASK, old_task, task)

    def perform_destroy(self, instance):
        record_delete_audit(self.request.user, AuditModule.TASK, instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def delete_summary(self, request, pk=None):
        task = self.get_object()
        return Response({
            'name': task.title,
            'message': f"Are you sure you want to delete task '{task.title}'? This action cannot be undone."
        })

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.mark_completed()
        log_activity(
            actor=request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.TASK,
            target_id=str(task.id),
            target_repr=f"Completed Task: {task.title}",
            details={'changes': {'status': {'old': TaskStatus.TODO, 'new': TaskStatus.COMPLETED}, 'completed_at': {'old': None, 'new': str(task.completed_at)}}}
        )
        return Response({'status': 'Task marked as completed.', 'task': TaskSerializer(task).data})

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        now = timezone.now()
        overdue_tasks = self.get_queryset().filter(
            due_date__lt=now
        ).exclude(
            status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED]
        )
        return Response(self.get_serializer(overdue_tasks, many=True).data)
