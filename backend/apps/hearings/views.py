from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Hearing, HearingStatus
from .serializers import HearingSerializer
from apps.audit.models import log_activity, AuditAction, AuditModule
from apps.accounts.permissions import IsInternalStaff


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

    def perform_create(self, serializer):
        hearing = serializer.save(created_by=self.request.user)
        log_activity(
            actor=self.request.user,
            action=AuditAction.CREATE,
            module=AuditModule.HEARING,
            target_id=hearing.id,
            target_repr=f"Hearing for {hearing.matter.matter_reference} on {hearing.hearing_date:%Y-%m-%d %H:%M}",
            details={'matter_id': hearing.matter_id, 'type': hearing.hearing_type}
        )

    def perform_update(self, serializer):
        hearing = serializer.save()
        log_activity(
            actor=self.request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.HEARING,
            target_id=hearing.id,
            target_repr=f"Hearing for {hearing.matter.matter_reference} on {hearing.hearing_date:%Y-%m-%d %H:%M}"
        )

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
        """
        hearing = self.get_object()
        outcome = request.data.get('outcome_summary', '').strip()
        next_date = request.data.get('next_hearing_date')
        
        hearing.outcome_summary = outcome
        hearing.status = HearingStatus.COMPLETED
        if next_date:
            hearing.next_hearing_date = next_date
        hearing.save(update_fields=['outcome_summary', 'status', 'next_hearing_date', 'updated_at'])

        log_activity(
            actor=request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.HEARING,
            target_id=hearing.id,
            target_repr=f"Outcome recorded for hearing {hearing.id} ({hearing.matter.matter_reference})",
            details={'outcome': outcome[:100]}
        )
        return Response(self.get_serializer(hearing).data)
