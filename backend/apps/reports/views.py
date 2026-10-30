import os
from io import BytesIO
from django.http import HttpResponse
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.negotiation import BaseContentNegotiation

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage

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


class IgnoreClientContentNegotiation(BaseContentNegotiation):
    def select_parser(self, request, parsers):
        return parsers[0] if parsers else None

    def select_renderer(self, request, renderers, format_suffix=None):
        return (renderers[0], renderers[0].media_type)


class ExportReportPDFView(APIView):
    """
    Export reports (matters, clients, or tasks) as formatted PDF using reportlab.
    """
    permission_classes = [IsAuthenticated, IsInternalStaff]
    content_negotiation_class = IgnoreClientContentNegotiation

    FIRM_NAME = "Siwolo P.O Law Advocates"

    def _build_pdf(self, title: str, headers: list, rows: list, filename: str, use_landscape: bool = False, inline: bool = False):
        buffer = BytesIO()
        pagesize = landscape(A4) if use_landscape else A4
        doc = SimpleDocTemplate(
            buffer,
            pagesize=pagesize,
            leftMargin=1.5 * cm,
            rightMargin=1.5 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Title'],
            fontSize=15,
            leading=18,
            alignment=0,  # Left-aligned next to logo
            spaceAfter=2,
            textColor=colors.HexColor('#111111'),
        )
        subtitle_style = ParagraphStyle(
            'ReportSubtitle',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#6B7280'),
            spaceAfter=0,
        )

        generated_at = timezone.now().strftime('%d %B %Y, %H:%M %Z')
        usable_width = (landscape(A4)[0] if use_landscape else A4[0]) - 3 * cm

        logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
        story = []
        if os.path.exists(logo_path):
            logo_img = RLImage(logo_path, width=1.6 * cm, height=1.6 * cm)
            header_text = [
                Paragraph(f"{title} — {self.FIRM_NAME}", title_style),
                Paragraph(f"Generated: {generated_at}", subtitle_style),
            ]
            header_table = Table(
                [[logo_img, header_text]],
                colWidths=[2.0 * cm, usable_width - 2.0 * cm],
            )
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LINEBELOW', (0, 0), (-1, 0), 0.75, colors.HexColor('#E5E7EB')),
            ]))
            story.append(header_table)
            story.append(Spacer(1, 0.4 * cm))
        else:
            story.extend([
                Paragraph(f"{title} — {self.FIRM_NAME}", title_style),
                Paragraph(f"Generated: {generated_at}", subtitle_style),
                Spacer(1, 0.4 * cm),
            ])

        # Calculate column widths evenly across the available page width
        col_count = len(headers)
        col_widths = [usable_width / col_count] * col_count

        # Build table data: header row + data rows
        cell_style = ParagraphStyle(
            'CellStyle',
            parent=styles['Normal'],
            fontSize=7,
            leading=9,
            wordWrap='CJK',
        )
        header_style = ParagraphStyle(
            'HeaderStyle',
            parent=styles['Normal'],
            fontSize=7.5,
            leading=10,
            textColor=colors.white,
            fontName='Helvetica-Bold',
        )

        table_data = [[Paragraph(h, header_style) for h in headers]]
        for row in rows:
            table_data.append([Paragraph(str(cell) if cell is not None else '', cell_style) for cell in row])

        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Alternating row shading
        row_count = len(table_data)
        style_commands = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#111111')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7.5),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#E5E7EB')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 1), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ]
        table.setStyle(TableStyle(style_commands))

        story.append(table)
        doc.build(story)

        buffer.seek(0)
        disposition = 'inline' if inline else 'attachment'
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        return response

    def get(self, request):
        report_type = request.query_params.get('type', 'matters')
        inline = request.query_params.get('mode') == 'view'

        if report_type == 'clients':
            headers = ['Client Reference', 'Name / Organization', 'Type', 'Phone', 'Email', 'Status', 'Registered Date']
            rows = [
                [
                    c.client_reference,
                    c.display_name,
                    c.get_client_type_display(),
                    c.phone_number,
                    c.email,
                    c.get_status_display(),
                    c.created_at.strftime('%Y-%m-%d'),
                ]
                for c in Client.objects.all().order_by('-created_at')
            ]
            return self._build_pdf('Clients Report', headers, rows, 'clients_report.pdf', use_landscape=False, inline=inline)

        elif report_type == 'tasks':
            headers = ['Title', 'Matter Reference', 'Assigned To', 'Priority', 'Status', 'Due Date', 'Created Date']
            rows = [
                [
                    t.title,
                    t.matter.matter_reference if t.matter else 'N/A',
                    t.assigned_to.full_name if t.assigned_to else 'Unassigned',
                    t.get_priority_display(),
                    t.get_status_display(),
                    t.due_date.strftime('%Y-%m-%d %H:%M') if t.due_date else 'N/A',
                    t.created_at.strftime('%Y-%m-%d'),
                ]
                for t in Task.objects.select_related('matter', 'assigned_to').all().order_by('due_date')
            ]
            return self._build_pdf('Tasks Report', headers, rows, 'tasks_report.pdf', use_landscape=False, inline=inline)

        else:  # default: matters
            headers = ['Matter Reference', 'Title', 'Client', 'Type', 'Status', 'Priority', 'Advocate', 'Court', 'Case Number', 'Date Opened']
            rows = [
                [
                    m.matter_reference,
                    m.title,
                    m.client.display_name if m.client else 'N/A',
                    m.get_matter_type_display(),
                    m.get_status_display(),
                    m.get_priority_display(),
                    m.assigned_advocate.full_name if m.assigned_advocate else 'Unassigned',
                    m.court,
                    m.case_number,
                    m.date_opened.strftime('%Y-%m-%d') if m.date_opened else 'N/A',
                ]
                for m in Matter.objects.select_related('client', 'assigned_advocate').all().order_by('-created_at')
            ]
            return self._build_pdf('Matters Report', headers, rows, 'matters_report.pdf', use_landscape=True, inline=inline)
