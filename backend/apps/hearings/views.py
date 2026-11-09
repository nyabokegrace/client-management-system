from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from config.date_utils import format_nairobi_datetime, parse_nairobi_datetime

from .models import Hearing, HearingStatus, HearingType
from .serializers import HearingSerializer
from apps.audit.models import AuditAction, AuditModule, log_activity
from apps.audit.utils import record_create_audit, record_update_audit, record_delete_audit
from apps.accounts.permissions import IsAdministrator, IsInternalStaff


class HearingViewSet(viewsets.ModelViewSet):
    """
    Court hearings and appearance schedule management.
    """
    queryset = Hearing.objects.all().select_related('matter', 'matter__client', 'assigned_advocate')
    serializer_class = HearingSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['matter', 'assigned_advocate', 'status', 'hearing_type']
    search_fields = [
        'court',
        'court_case_number',
        'location_details',
        'notes',
        'outcome_summary',
        'matter__matter_reference',
        'matter__title',
        'matter__client__first_name',
        'matter__client__last_name',
        'matter__client__organization_name',
    ]
    ordering_fields = ['hearing_date', 'created_at']
    ordering = ['hearing_date']

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAdministrator()]
        return [IsAuthenticated(), IsInternalStaff()]

    def perform_create(self, serializer):
        hearing = serializer.save(created_by=self.request.user)
        record_create_audit(self.request.user, AuditModule.HEARING, hearing)

    def perform_update(self, serializer):
        old_hearing = Hearing.objects.get(pk=serializer.instance.pk)
        hearing = serializer.save()
        record_update_audit(self.request.user, AuditModule.HEARING, old_hearing, hearing)

    def perform_destroy(self, instance):
        record_delete_audit(self.request.user, AuditModule.HEARING, instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def delete_summary(self, request, pk=None):
        hearing = self.get_object()
        date_str = format_nairobi_datetime(hearing.hearing_date) if hearing.hearing_date else 'Scheduled'
        ref = hearing.matter.matter_reference if hearing.matter else ''
        return Response({
            'name': f"{hearing.get_hearing_type_display()} on {date_str}",
            'reference': ref,
            'message': f"Are you sure you want to delete hearing on {date_str} for matter {ref}? This action cannot be undone."
        })

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """
        List hearings scheduled from today onwards.
        """
        now = timezone.now()
        hearings = self.get_queryset().filter(hearing_date__gte=now).order_by('hearing_date')[:20]
        serializer = self.get_serializer(hearings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def record_outcome(self, request, pk=None):
        """
        Record proceedings outcome, directions and optional next hearing date.
        Creates a new scheduled hearing when next hearing date is supplied.
        """
        with transaction.atomic():
            hearing = self.get_object()
            outcome = request.data.get('outcome_summary', '').strip()
            next_date = request.data.get('next_hearing_date')

            old_status = hearing.status
            old_outcome = hearing.outcome_summary
            old_next = hearing.next_hearing_date

            hearing.outcome_summary = outcome
            hearing.status = HearingStatus.COMPLETED
            if next_date:
                hearing.next_hearing_date = parse_nairobi_datetime(next_date)
            hearing.save(update_fields=['outcome_summary', 'status', 'next_hearing_date', 'updated_at'])

            log_activity(
                actor=request.user,
                action=AuditAction.UPDATE,
                module=AuditModule.HEARING,
                target_id=str(hearing.id),
                target_repr=f"Outcome recorded for hearing {hearing.id} ({hearing.matter.matter_reference})",
                details={'changes': {
                    'outcome_summary': {'old': old_outcome, 'new': outcome},
                    'status': {'old': old_status, 'new': HearingStatus.COMPLETED},
                    'next_hearing_date': {'old': str(old_next) if old_next else None, 'new': str(next_date) if next_date else None}
                }}
            )

            # Fix existing gap in record_outcome: create the new scheduled hearing
            if next_date:
                next_dt = parse_nairobi_datetime(next_date)
                next_type = request.data.get('next_hearing_type') or HearingType.MENTION
                court_name = request.data.get('court') or hearing.court or (hearing.matter.court if hearing.matter else '')
                new_hearing = Hearing.objects.create(
                    matter=hearing.matter,
                    hearing_type=next_type,
                    hearing_date=next_dt,
                    court=court_name,
                    court_case_number=hearing.court_case_number or (hearing.matter.case_number if hearing.matter else '') or '',
                    assigned_advocate=hearing.assigned_advocate,
                    status=HearingStatus.SCHEDULED,
                    created_by=request.user,
                )
                record_create_audit(request.user, AuditModule.HEARING, new_hearing)

            return Response(self.get_serializer(hearing).data)
