from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import CaseUpdate
from .serializers import CaseUpdateSerializer
from apps.hearings.models import Hearing, HearingStatus, HearingType
from apps.tasks.models import Task, TaskStatus, TaskPriority
from config.date_utils import parse_nairobi_datetime
from apps.audit.models import AuditAction, AuditModule, log_activity
from apps.audit.utils import record_create_audit, record_update_audit, record_delete_audit
from apps.accounts.permissions import IsAdministrator, IsInternalStaff


class CaseUpdateViewSet(viewsets.ModelViewSet):
    """
    Chronological progress updates for legal matters.
    Optionally links to completed hearings and generates scheduled hearings & action tasks.
    """
    queryset = CaseUpdate.objects.all().select_related('matter', 'author', 'hearing').prefetch_related('generated_hearings', 'generated_tasks')
    serializer_class = CaseUpdateSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['matter', 'category', 'author', 'share_with_client']
    search_fields = ['title', 'description', 'matter__matter_reference', 'matter__title']
    ordering_fields = ['event_datetime', 'created_at']
    ordering = ['-event_datetime']

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAdministrator()]
        return [IsAuthenticated(), IsInternalStaff()]

    def perform_create(self, serializer):
        with transaction.atomic():
            next_court_date = serializer.validated_data.pop('next_court_date', None)
            orders = serializer.validated_data.pop('orders', None)
            serializer.validated_data.pop('update_linked_records', True)

            update = serializer.save(author=self.request.user)
            record_create_audit(self.request.user, AuditModule.CASE_UPDATE, update)

            # 1. Complete selected hearing and copy description into outcome
            if update.hearing:
                h = update.hearing
                old_h_status = h.status
                old_h_outcome = h.outcome_summary
                h.status = HearingStatus.COMPLETED
                h.outcome_summary = update.description
                if next_court_date and next_court_date.get('hearing_date'):
                    h.next_hearing_date = parse_nairobi_datetime(next_court_date['hearing_date'])
                h.save(update_fields=['status', 'outcome_summary', 'next_hearing_date', 'updated_at'])
                log_activity(
                    actor=self.request.user,
                    action=AuditAction.UPDATE,
                    module=AuditModule.HEARING,
                    target_id=str(h.id),
                    target_repr=f"Hearing {h.id} marked completed via case update",
                    details={'changes': {
                        'status': {'old': old_h_status, 'new': HearingStatus.COMPLETED},
                        'outcome_summary': {'old': old_h_outcome, 'new': update.description}
                    }}
                )

            # 2. If next court date provided, create new scheduled hearing
            if next_court_date and next_court_date.get('hearing_date'):
                h_date = parse_nairobi_datetime(next_court_date.get('hearing_date'))
                h_type = next_court_date.get('hearing_type') or HearingType.MENTION
                h_court = next_court_date.get('court') or (update.matter.court if update.matter else '')
                new_hearing = Hearing.objects.create(
                    matter=update.matter,
                    hearing_type=h_type,
                    hearing_date=h_date,
                    court=h_court,
                    court_case_number=(update.matter.case_number if update.matter else '') or '',
                    assigned_advocate=update.matter.assigned_advocate if update.matter else None,
                    status=HearingStatus.SCHEDULED,
                    originating_update=update,
                    created_by=self.request.user,
                )
                record_create_audit(self.request.user, AuditModule.HEARING, new_hearing)

            # 3. For each order row, create task on that matter with that deadline
            if orders:
                for order in orders:
                    desc = (order.get('description') or '').strip()
                    due = parse_nairobi_datetime(order.get('due_date'))
                    priority = order.get('priority') or TaskPriority.HIGH
                    if desc:
                        new_task = Task.objects.create(
                            matter=update.matter,
                            client=update.matter.client if update.matter else None,
                            title=desc[:255],
                            description=desc,
                            due_date=due,
                            priority=priority,
                            status=TaskStatus.TODO,
                            assigned_to=update.matter.assigned_advocate if update.matter else None,
                            originating_update=update,
                            created_by=self.request.user,
                        )
                        record_create_audit(self.request.user, AuditModule.TASK, new_task)

    def perform_update(self, serializer):
        with transaction.atomic():
            next_court_date = serializer.validated_data.pop('next_court_date', None)
            orders = serializer.validated_data.pop('orders', None)
            update_linked_records = serializer.validated_data.pop('update_linked_records', True)

            old_update = CaseUpdate.objects.get(pk=serializer.instance.pk)
            update = serializer.save()
            record_update_audit(self.request.user, AuditModule.CASE_UPDATE, old_update, update)

            if update_linked_records:
                # Update selected hearing outcome if set
                if update.hearing:
                    h = update.hearing
                    h.status = HearingStatus.COMPLETED
                    h.outcome_summary = update.description
                    if next_court_date and next_court_date.get('hearing_date'):
                        h.next_hearing_date = parse_nairobi_datetime(next_court_date['hearing_date'])
                    h.save(update_fields=['status', 'outcome_summary', 'next_hearing_date', 'updated_at'])

                # Update or create next court date hearing
                if next_court_date is not None:
                    h_date = parse_nairobi_datetime(next_court_date.get('hearing_date'))
                    h_type = next_court_date.get('hearing_type') or HearingType.MENTION
                    h_court = next_court_date.get('court') or (update.matter.court if update.matter else '')

                    existing_hearing = update.generated_hearings.first()
                    if existing_hearing:
                        if h_date:
                            old_h = Hearing.objects.get(pk=existing_hearing.pk)
                            existing_hearing.hearing_date = h_date
                            existing_hearing.hearing_type = h_type
                            existing_hearing.court = h_court
                            existing_hearing.save()
                            record_update_audit(self.request.user, AuditModule.HEARING, old_h, existing_hearing)
                    elif h_date:
                        new_hearing = Hearing.objects.create(
                            matter=update.matter,
                            hearing_type=h_type,
                            hearing_date=h_date,
                            court=h_court,
                            court_case_number=(update.matter.case_number if update.matter else '') or '',
                            assigned_advocate=update.matter.assigned_advocate if update.matter else None,
                            status=HearingStatus.SCHEDULED,
                            originating_update=update,
                            created_by=self.request.user,
                        )
                        record_create_audit(self.request.user, AuditModule.HEARING, new_hearing)

                # Sync orders / tasks
                if orders is not None:
                    existing_tasks = list(update.generated_tasks.all())
                    existing_by_id = {t.id: t for t in existing_tasks}
                    kept_ids = set()

                    for order in orders:
                        task_id = order.get('id')
                        desc = (order.get('description') or '').strip()
                        due = parse_nairobi_datetime(order.get('due_date'))
                        priority = order.get('priority') or TaskPriority.HIGH
                        if not desc:
                            continue

                        if task_id and task_id in existing_by_id:
                            task = existing_by_id[task_id]
                            kept_ids.add(task.id)
                            old_task = Task.objects.get(pk=task.pk)
                            task.title = desc[:255]
                            task.description = desc
                            task.due_date = due
                            task.priority = priority
                            task.save()
                            record_update_audit(self.request.user, AuditModule.TASK, old_task, task)
                        else:
                            new_task = Task.objects.create(
                                matter=update.matter,
                                client=update.matter.client if update.matter else None,
                                title=desc[:255],
                                description=desc,
                                due_date=due,
                                priority=priority,
                                status=TaskStatus.TODO,
                                assigned_to=update.matter.assigned_advocate if update.matter else None,
                                originating_update=update,
                                created_by=self.request.user,
                            )
                            kept_ids.add(new_task.id)
                            record_create_audit(self.request.user, AuditModule.TASK, new_task)

                    for t in existing_tasks:
                        if t.id not in kept_ids:
                            record_delete_audit(self.request.user, AuditModule.TASK, t)
                            t.delete()

    def perform_destroy(self, instance):
        remove_linked = self.request.query_params.get('remove_linked') == 'true'
        with transaction.atomic():
            if remove_linked:
                for h in instance.generated_hearings.all():
                    record_delete_audit(self.request.user, AuditModule.HEARING, h)
                    h.delete()
                for t in instance.generated_tasks.all():
                    record_delete_audit(self.request.user, AuditModule.TASK, t)
                    t.delete()
            record_delete_audit(self.request.user, AuditModule.CASE_UPDATE, instance)
            instance.delete()

    @action(detail=True, methods=['get'])
    def delete_summary(self, request, pk=None):
        update = self.get_object()
        ref = update.matter.matter_reference if update.matter else ''
        gen_hearings = list(update.generated_hearings.values('id', 'hearing_type', 'hearing_date'))
        gen_tasks = list(update.generated_tasks.values('id', 'title', 'due_date', 'status'))
        has_completed_tasks = any(t['status'] == TaskStatus.COMPLETED for t in gen_tasks)

        parts = []
        if gen_hearings:
            parts.append(f"{len(gen_hearings)} scheduled hearing(s)")
        if gen_tasks:
            parts.append(f"{len(gen_tasks)} action task(s)")
        linked_str = f" This update generated {', '.join(parts)}." if parts else ""

        return Response({
            'name': update.title,
            'reference': ref,
            'generated_hearings': gen_hearings,
            'generated_tasks': gen_tasks,
            'has_completed_tasks': has_completed_tasks,
            'message': f"Are you sure you want to delete case update '{update.title}'?{linked_str} This action cannot be undone."
        })
