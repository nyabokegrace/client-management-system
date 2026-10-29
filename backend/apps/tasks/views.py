from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Task, TaskStatus
from .serializers import TaskSerializer
from apps.audit.models import log_activity, AuditAction, AuditModule
from apps.accounts.permissions import IsInternalStaff


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

    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        log_activity(
            actor=self.request.user,
            action=AuditAction.CREATE,
            module=AuditModule.TASK,
            target_id=task.id,
            target_repr=f"Task: {task.title}",
            details={'assigned_to': task.assigned_to_id, 'priority': task.priority, 'due_date': str(task.due_date)}
        )

    def perform_update(self, serializer):
        task = serializer.save()
        log_activity(
            actor=self.request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.TASK,
            target_id=task.id,
            target_repr=f"Task: {task.title}",
            details={'status': task.status, 'assigned_to': task.assigned_to_id}
        )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.mark_completed()
        log_activity(
            actor=request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.TASK,
            target_id=task.id,
            target_repr=f"Completed Task: {task.title}",
            details={'completed_at': str(task.completed_at)}
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
