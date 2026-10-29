import csv
from django.http import HttpResponse
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.clients.models import Client, ClientStatus, ClientType
from apps.matters.models import Matter, MatterStatus
from apps.matters.serializers import MatterListSerializer
from apps.hearings.models import Hearing, HearingStatus
from apps.hearings.serializers import HearingSerializer
from apps.tasks.models import Task, TaskStatus
from apps.tasks.serializers import TaskSerializer
from apps.case_updates.models import CaseUpdate
from apps.case_updates.serializers import CaseUpdateSerializer
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.accounts.models import User, UserRole
from apps.accounts.permissions import IsInternalStaff


class DashboardSummaryView(APIView):
    """
    Live aggregated statistics and recent records for the main application dashboard.
    """
    permission_classes = [IsAuthenticated, IsInternalStaff]

    def get(self, request):
        now = timezone.now()

        # Summary KPIs
        active_matters_count = Matter.objects.filter(
            status__in=[MatterStatus.NEW, MatterStatus.ACTIVE, MatterStatus.PENDING, MatterStatus.AWAITING_CLIENT, MatterStatus.AWAITING_COURT]
        ).count()
        registered_clients_count = Client.objects.exclude(status=ClientStatus.ARCHIVED).count()
        upcoming_hearings_count = Hearing.objects.filter(
            hearing_date__gte=now,
            status=HearingStatus.SCHEDULED
        ).count()
        overdue_tasks_count = Task.objects.filter(
            due_date__lt=now
        ).exclude(
            status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED]
        ).count()

        # Recent records for dashboard widgets
        upcoming_hearings = Hearing.objects.filter(
            hearing_date__gte=now
        ).select_related('matter', 'matter__client', 'assigned_advocate').order_by('hearing_date')[:5]

        tasks_requiring_attention = Task.objects.filter(
            status__in=[TaskStatus.TODO, TaskStatus.IN_PROGRESS]
        ).select_related('matter', 'client', 'assigned_to').order_by('due_date', '-priority')[:5]

        recently_updated_matters = Matter.objects.select_related(
            'client', 'assigned_advocate'
        ).order_by('-updated_at')[:5]

        recent_case_updates = CaseUpdate.objects.select_related(
            'matter', 'author'
        ).order_by('-event_datetime', '-created_at')[:5]

        # Audit activity (Admins see all; others see their own or non-administrative module activity)
        if request.user.is_administrator:
            recent_audit = AuditLog.objects.order_by('-created_at')[:8]
        else:
            recent_audit = AuditLog.objects.filter(
                Q(actor=request.user) | ~Q(module='AUTH')
            ).order_by('-created_at')[:8]

        return Response({
            'kpis': {
                'active_matters': active_matters_count,
                'registered_clients': registered_clients_count,
                'upcoming_hearings': upcoming_hearings_count,
                'overdue_tasks': overdue_tasks_count,
            },
            'upcoming_hearings': HearingSerializer(upcoming_hearings, many=True).data,
            'tasks_requiring_attention': TaskSerializer(tasks_requiring_attention, many=True).data,
            'recently_updated_matters': MatterListSerializer(recently_updated_matters, many=True).data,
            'recent_case_updates': CaseUpdateSerializer(recent_case_updates, many=True).data,
            'recent_activity': AuditLogSerializer(recent_audit, many=True).data,
        })


class AnalyticsReportsView(APIView):
    """
    Detailed analytics: matters by status, workload by advocate, clients distribution.
    """
    permission_classes = [IsAuthenticated, IsInternalStaff]

    def get(self, request):
        # Matters by status
        matters_by_status = list(
            Matter.objects.values('status').annotate(count=Count('id')).order_by('-count')
        )
        # Matters by type
        matters_by_type = list(
            Matter.objects.values('matter_type').annotate(count=Count('id')).order_by('-count')
        )
        # Clients by type
        clients_by_type = list(
            Client.objects.values('client_type').annotate(count=Count('id')).order_by('-count')
        )
        # Advocate workload
        advocates = User.objects.filter(role__in=[UserRole.ADVOCATE, UserRole.ADMIN], is_active=True)
        workload = []
        for adv in advocates:
            matters_count = Matter.objects.filter(assigned_advocate=adv).count()
            tasks_count = Task.objects.filter(assigned_to=adv).exclude(status=TaskStatus.COMPLETED).count()
            hearings_count = Hearing.objects.filter(assigned_advocate=adv, hearing_date__gte=timezone.now()).count()
            workload.append({
                'advocate_id': adv.id,
                'advocate_name': adv.full_name,
                'active_matters': matters_count,
                'pending_tasks': tasks_count,
                'upcoming_hearings': hearings_count,
            })

        return Response({
            'matters_by_status': matters_by_status,
            'matters_by_type': matters_by_type,
            'clients_by_type': clients_by_type,
            'advocate_workload': workload,
        })


class ExportReportCSVView(APIView):
    """
    Export reports (matters, clients, or tasks) as formatted CSV.
    """
    permission_classes = [IsAuthenticated, IsInternalStaff]

    def get(self, request):
        report_type = request.query_params.get('type', 'matters')
        response = HttpResponse(content_type='text/csv')
        
        if report_type == 'clients':
            response['Content-Disposition'] = 'attachment; filename="clients_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['Client Reference', 'Name / Organization', 'Type', 'Phone', 'Email', 'Status', 'Registered Date'])
            for client in Client.objects.all().order_by('-created_at'):
                writer.writerow([
                    client.client_reference,
                    client.display_name,
                    client.get_client_type_display(),
                    client.phone_number,
                    client.email,
                    client.get_status_display(),
                    client.created_at.strftime('%Y-%m-%d')
                ])
        elif report_type == 'tasks':
            response['Content-Disposition'] = 'attachment; filename="tasks_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['Title', 'Matter Reference', 'Assigned To', 'Priority', 'Status', 'Due Date', 'Created Date'])
            for task in Task.objects.select_related('matter', 'assigned_to').all().order_by('due_date'):
                writer.writerow([
                    task.title,
                    task.matter.matter_reference if task.matter else 'N/A',
                    task.assigned_to.full_name if task.assigned_to else 'Unassigned',
                    task.get_priority_display(),
                    task.get_status_display(),
                    task.due_date.strftime('%Y-%m-%d %H:%M') if task.due_date else 'N/A',
                    task.created_at.strftime('%Y-%m-%d')
                ])
        else: # default matters
            response['Content-Disposition'] = 'attachment; filename="matters_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['Matter Reference', 'Title', 'Client', 'Type', 'Status', 'Priority', 'Assigned Advocate', 'Court', 'Case Number', 'Date Opened'])
            for m in Matter.objects.select_related('client', 'assigned_advocate').all().order_by('-created_at'):
                writer.writerow([
                    m.matter_reference,
                    m.title,
                    m.client.display_name if m.client else 'N/A',
                    m.get_matter_type_display(),
                    m.get_status_display(),
                    m.get_priority_display(),
                    m.assigned_advocate.full_name if m.assigned_advocate else 'Unassigned',
                    m.court,
                    m.case_number,
                    m.date_opened.strftime('%Y-%m-%d') if m.date_opened else 'N/A'
                ])

        return response
