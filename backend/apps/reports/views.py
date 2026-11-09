import os
from io import BytesIO
from django.conf import settings
from django.http import HttpResponse
from django.db.models import Count, Q
from django.utils import timezone
from config.date_utils import format_nairobi_datetime, format_nairobi_date, parse_nairobi_datetime
from rest_framework.views import APIView
from rest_framework import status
from pathlib import Path
from apps.documents.models import Document, DocumentCategory, ConfidentialityLevel, get_private_upload_path
from apps.audit.models import AuditAction, AuditModule, log_activity
from apps.audit.utils import record_create_audit
from .models import ClientReport, ReportMode
from .serializers import ClientReportSerializer
from .client_report_pdf import generate_client_report_pdf
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

    @property
    def firm_name(self):
        return getattr(settings, 'FIRM_NAME', "Siwolo P.O Law Advocates")

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

        generated_at = format_nairobi_datetime(timezone.now())
        usable_width = (landscape(A4)[0] if use_landscape else A4[0]) - 3 * cm

        logo_path = os.path.join(os.path.dirname(__file__), 'logo.png')
        story = []
        if os.path.exists(logo_path):
            logo_img = RLImage(logo_path, width=1.6 * cm, height=1.6 * cm)
            header_text = [
                Paragraph(f"{title} — {self.firm_name}", title_style),
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
                Paragraph(f"{title} — {self.firm_name}", title_style),
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
                    format_nairobi_date(c.created_at),
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
                    format_nairobi_datetime(t.due_date),
                    format_nairobi_date(t.created_at),
                ]
                for t in Task.objects.select_related('matter', 'assigned_to').all().order_by('due_date')
            ]
            return self._build_pdf('Tasks Report', headers, rows, 'tasks_report.pdf', use_landscape=False, inline=inline)

        else:  # default: matters
            headers = [
                'Matter Reference',
                'Title',
                'Client',
                'Location',
                'Type',
                'Status',
                'Priority',
                'Advocate',
                'Opposing Counsel',
                'Court',
                'Case Number',
                'Date Opened',
            ]
            rows = [
                [
                    m.matter_reference,
                    m.title,
                    m.client.display_name if m.client else 'N/A',
                    m.location or 'N/A',
                    m.get_matter_type_display(),
                    m.get_status_display(),
                    m.get_priority_display(),
                    m.assigned_advocate.full_name if m.assigned_advocate else 'Unassigned',
                    m.opposing_contact.name if m.opposing_contact else (m.opposing_advocate or 'N/A'),
                    m.court,
                    m.case_number,
                    format_nairobi_date(m.date_opened),
                ]
                for m in Matter.objects.select_related('client', 'assigned_advocate', 'opposing_contact').all().order_by('-created_at')
            ]
            return self._build_pdf('Matters Report', headers, rows, 'matters_report.pdf', use_landscape=True, inline=inline)


class ClientReportListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalStaff]

    def get(self, request):
        matter_id = request.query_params.get('matter')
        if not matter_id:
            return Response({'error': 'matter parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        matter = Matter.objects.filter(pk=matter_id).first()
        if not matter:
            return Response({'error': 'Matter not found'}, status=status.HTTP_404_NOT_FOUND)

        reports = ClientReport.objects.filter(matter=matter).select_related('document', 'generated_by').order_by('-generated_at')
        last_sent = reports.filter(sent_at__isnull=False).order_by('-sent_at').first()

        return Response({
            'matter_id': matter.id,
            'matter_reference': matter.matter_reference,
            'has_sent_report': last_sent is not None,
            'last_sent_at': last_sent.sent_at if last_sent else None,
            'last_sent_at_display': format_nairobi_datetime(last_sent.sent_at) if last_sent else None,
            'reports': ClientReportSerializer(reports, many=True).data,
        })


class GenerateClientReportView(APIView):
    permission_classes = [IsAuthenticated, IsInternalStaff]

    def post(self, request):
        matter_id = request.data.get('matter_id')
        if not matter_id:
            return Response({'error': 'matter_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        matter = Matter.objects.select_related('client').filter(pk=matter_id).first()
        if not matter:
            return Response({'error': 'Matter not found'}, status=status.HTTP_404_NOT_FOUND)

        mode = request.data.get('mode', ReportMode.FULL_HISTORY)
        now = timezone.now()

        # Base query: only client-facing updates (never include internal review notes)
        updates_qs = CaseUpdate.objects.filter(
            matter=matter,
            share_with_client=True
        ).select_related('hearing').order_by('event_datetime')

        period_start = None
        period_end = now

        if mode == ReportMode.SINCE_LAST_SENT:
            last_sent = matter.client_reports.filter(sent_at__isnull=False).order_by('-sent_at').first()
            if not last_sent:
                return Response(
                    {'error': 'No previous report has been marked as sent for this matter.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            cutoff = last_sent.generated_at
            period_start = cutoff
            # Cutoff is based on when update was entered (created_at), not event_datetime, so backdated updates are included
            updates_qs = updates_qs.filter(created_at__gt=cutoff)
            if last_sent.update_ids:
                updates_qs = updates_qs.exclude(id__in=last_sent.update_ids)
            period_covered = f"Updates since last sent report ({format_nairobi_datetime(last_sent.sent_at)})"

        elif mode == ReportMode.CUSTOM_RANGE:
            start_str = request.data.get('start_date')
            end_str = request.data.get('end_date')
            if not start_str or not end_str:
                return Response(
                    {'error': 'Both start_date and end_date are required for custom date range.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            start_dt = parse_nairobi_datetime(start_str)
            end_dt = parse_nairobi_datetime(end_str)
            if not start_dt or not end_dt:
                return Response(
                    {'error': 'Invalid date format provided.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if end_dt.hour == 0 and end_dt.minute == 0:
                end_dt = end_dt.replace(hour=23, minute=59, second=59)
            period_start = start_dt
            period_end = end_dt
            updates_qs = updates_qs.filter(event_datetime__gte=start_dt, event_datetime__lte=end_dt)
            period_covered = f"{format_nairobi_date(start_dt)} to {format_nairobi_date(end_dt)}"

        else:
            mode = ReportMode.FULL_HISTORY
            period_covered = f"Full history up to {format_nairobi_datetime(now)}"

        updates = list(updates_qs)

        # Prominently show next scheduled court date if one is currently scheduled
        next_hearing = Hearing.objects.filter(
            matter=matter,
            status=HearingStatus.SCHEDULED,
            hearing_date__gte=now
        ).order_by('hearing_date').first()

        # Generate PDF bytes
        pdf_bytes = generate_client_report_pdf(
            matter=matter,
            updates=updates,
            next_hearing=next_hearing,
            period_covered=period_covered,
            generated_at=now
        )

        # Save to private documents storage
        client = matter.client
        safe_ref = matter.matter_reference.replace('/', '_').replace(' ', '_')
        filename = f"Client_Report_{safe_ref}_{now.strftime('%Y%m%d_%H%M%S')}.pdf"
        rel_storage_path = get_private_upload_path(client, filename)
        full_dest_path = Path(settings.PRIVATE_STORAGE_ROOT) / rel_storage_path
        full_dest_path.parent.mkdir(parents=True, exist_ok=True)

        with open(full_dest_path, 'wb+') as destination:
            destination.write(pdf_bytes)

        # Create Document record
        doc = Document.objects.create(
            title=f"Client Report - {matter.matter_reference} ({format_nairobi_date(now)})",
            category=DocumentCategory.CLIENT_REPORT,
            confidentiality=ConfidentialityLevel.STANDARD,
            client=client,
            matter=matter,
            original_filename=filename,
            storage_path=rel_storage_path,
            file_type='application/pdf',
            file_size_bytes=len(pdf_bytes),
            description=f"Client progress report covering {period_covered}",
            uploaded_by=request.user
        )
        record_create_audit(request.user, AuditModule.DOCUMENT, doc)

        # Create ClientReport tracking record
        report = ClientReport.objects.create(
            matter=matter,
            client=client,
            document=doc,
            mode=mode,
            period_start=period_start,
            period_end=period_end,
            period_covered=period_covered,
            update_ids=[u.id for u in updates],
            generated_at=now,
            generated_by=request.user,
        )

        log_activity(
            actor=request.user,
            action=AuditAction.CREATE,
            module=AuditModule.REPORT,
            target_id=str(report.id),
            target_repr=f"Client report generated for {matter.matter_reference} ({period_covered})",
            details={
                'matter_id': matter.id,
                'matter_reference': matter.matter_reference,
                'mode': mode,
                'period_covered': period_covered,
                'document_id': doc.id,
                'updates_count': len(updates),
            }
        )

        return Response(ClientReportSerializer(report).data, status=status.HTTP_201_CREATED)


class MarkClientReportSentView(APIView):
    permission_classes = [IsAuthenticated, IsInternalStaff]

    def post(self, request, pk=None):
        report = ClientReport.objects.select_related('matter').filter(pk=pk).first()
        if not report:
            return Response({'error': 'Client report not found'}, status=status.HTTP_404_NOT_FOUND)

        old_sent = report.sent_at
        report.sent_at = timezone.now()
        report.save(update_fields=['sent_at'])

        log_activity(
            actor=request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.REPORT,
            target_id=str(report.id),
            target_repr=f"Client report {report.id} marked as sent for {report.matter.matter_reference}",
            details={'changes': {
                'sent_at': {'old': str(old_sent) if old_sent else None, 'new': str(report.sent_at)}
            }}
        )

        return Response(ClientReportSerializer(report).data, status=status.HTTP_200_OK)
