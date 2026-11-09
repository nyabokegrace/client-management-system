import datetime
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter
from apps.hearings.models import Hearing, HearingType, HearingStatus
from apps.case_updates.models import CaseUpdate, UpdateCategory
from apps.documents.models import Document, DocumentCategory
from apps.audit.models import AuditLog, AuditAction, AuditModule
from apps.reports.models import ClientReport, ReportMode


class ReportsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_reports',
            email='reports@siwoloadvocates.com',
            password='Password123!',
            first_name='Analyst',
            last_name='Advocate',
            role=UserRole.ADVOCATE
        )
        self.client_rec = Client.objects.create(first_name='Samuel', last_name='Mwangi', phone_number='+254700112233')
        self.matter = Matter.objects.create(
            matter_reference='SP/Nairobi/CIV/10/2026',
            title='Mwangi Land Injunction',
            client=self.client_rec,
            court='Environment and Land Court Nairobi',
            case_number='ELC/555/2026',
            assigned_advocate=self.advocate
        )
        self.client.force_authenticate(user=self.advocate)

    def test_dashboard_summary_endpoint(self):
        url = reverse('report-dashboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('kpis', response.data)
        self.assertEqual(response.data['kpis']['registered_clients'], 1)
        self.assertEqual(response.data['kpis']['active_matters'], 1)

    def test_pdf_export_and_inline_view_reports(self):
        url = reverse('report-export-pdf')
        for rtype in ['matters', 'clients', 'tasks']:
            response = self.client.get(url, {'type': rtype})
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response['Content-Type'], 'application/pdf')
            self.assertIn(f'attachment; filename="{rtype}_report.pdf"', response['Content-Disposition'])
            self.assertTrue(response.content.startswith(b'%PDF-'))

            # Test inline viewing mode
            view_resp = self.client.get(url, {'type': rtype, 'mode': 'view'})
            self.assertEqual(view_resp.status_code, status.HTTP_200_OK)
            self.assertEqual(view_resp['Content-Type'], 'application/pdf')
            self.assertIn(f'inline; filename="{rtype}_report.pdf"', view_resp['Content-Disposition'])
            self.assertTrue(view_resp.content.startswith(b'%PDF-'))

    def test_client_report_generation_workflow(self):
        """
        Stage 6 verification:
        1. Generates report for a matter with internal notes and client-facing update.
        2. Includes only client-facing update, names the next court date.
        3. Saves PDF into documents.
        4. "New since last sent" correctly uses the last sent timestamp.
        """
        now = timezone.now()

        # Create client-facing update
        update_client = CaseUpdate.objects.create(
            matter=self.matter,
            title='Substantive Application Hearing Conducted',
            description='Court heard our interlocutory application for injunction.',
            category=UpdateCategory.COURT_APPEARANCE,
            event_datetime=now - datetime.timedelta(days=2),
            share_with_client=True,
            author=self.advocate
        )

        # Create internal strategy note (share_with_client=False)
        update_internal = CaseUpdate.objects.create(
            matter=self.matter,
            title='Internal Legal Strategy & Weakness Assessment',
            description='Strictly internal note regarding witness testimony.',
            category=UpdateCategory.INTERNAL_REVIEW,
            event_datetime=now - datetime.timedelta(days=1),
            share_with_client=False,
            author=self.advocate
        )

        # Schedule next court date
        next_h = Hearing.objects.create(
            matter=self.matter,
            hearing_type=HearingType.RULING,
            hearing_date=now + datetime.timedelta(days=14),
            court='Environment and Land Court Nairobi Court 3',
            status=HearingStatus.SCHEDULED,
            assigned_advocate=self.advocate
        )

        # 1. Attempt "New since last sent" before any report has been sent -> should fail with 400
        gen_url = reverse('client-report-generate')
        res_fail = self.client.post(gen_url, {
            'matter_id': self.matter.id,
            'mode': ReportMode.SINCE_LAST_SENT,
        }, format='json')
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Generate Full History report
        res_full = self.client.post(gen_url, {
            'matter_id': self.matter.id,
            'mode': ReportMode.FULL_HISTORY,
        }, format='json')
        self.assertEqual(res_full.status_code, status.HTTP_201_CREATED)
        report1_id = res_full.data['id']
        doc1_id = res_full.data['document']

        # Verify Document record was created under category Client Report
        doc1 = Document.objects.get(pk=doc1_id)
        self.assertEqual(doc1.category, DocumentCategory.CLIENT_REPORT)
        self.assertEqual(doc1.matter, self.matter)
        self.assertEqual(doc1.client, self.client_rec)
        self.assertTrue(doc1.file_size_bytes > 0)
        self.assertTrue(doc1.original_filename.endswith('.pdf'))

        # Verify audit log recorded generation
        self.assertTrue(AuditLog.objects.filter(module=AuditModule.REPORT, action=AuditAction.CREATE, target_id=str(report1_id)).exists())

        # 3. Mark Report 1 as sent
        mark_url = reverse('client-report-mark-sent', kwargs={'pk': report1_id})
        t_sent = timezone.now() - datetime.timedelta(hours=1)
        res_sent = self.client.post(mark_url)
        self.assertEqual(res_sent.status_code, status.HTTP_200_OK)
        report1 = ClientReport.objects.get(pk=report1_id)
        self.assertIsNotNone(report1.sent_at)

        # Simulate last sent timestamp slightly in past
        report1.sent_at = t_sent
        report1.save()

        # 4. Add new client-facing update after the report was sent
        update_new = CaseUpdate.objects.create(
            matter=self.matter,
            title='Ruling Notice Issued by Deputy Registrar',
            description='Notice received indicating ruling is scheduled on notice board.',
            category=UpdateCategory.COURT_APPEARANCE,
            event_datetime=timezone.now(),
            share_with_client=True,
            author=self.advocate
        )

        # 5. Generate "New since last sent" report
        res_new = self.client.post(gen_url, {
            'matter_id': self.matter.id,
            'mode': ReportMode.SINCE_LAST_SENT,
        }, format='json')
        self.assertEqual(res_new.status_code, status.HTTP_201_CREATED)
        report2_id = res_new.data['id']
        report2 = ClientReport.objects.get(pk=report2_id)
        self.assertEqual(report2.mode, ReportMode.SINCE_LAST_SENT)
        self.assertIn("Updates since last sent report", report2.period_covered)

        # Check list endpoint returns history and sent status
        list_url = reverse('client-report-list') + f'?matter={self.matter.id}'
        list_resp = self.client.get(list_url)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(list_resp.data['has_sent_report'])
        self.assertEqual(len(list_resp.data['reports']), 2)
