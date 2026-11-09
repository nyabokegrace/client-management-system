from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter, MatterStatus, MatterPriority, MatterType
from apps.hearings.models import Hearing
from apps.tasks.models import Task
from apps.case_updates.models import CaseUpdate
from apps.documents.models import Document
from apps.audit.models import AuditLog, AuditAction


class MatterManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_peter',
            email='peter@siwoloadvocates.com',
            password='Password123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADVOCATE
        )
        self.client_record = Client.objects.create(
            first_name='Kariuki',
            last_name='Njoroge',
            phone_number='+254722222222',
            created_by=self.advocate
        )
        self.client.force_authenticate(user=self.advocate)

    def test_create_matter_unique_reference(self):
        url = reverse('matter-list')
        data = {
            'title': 'Kariuki v. XYZ Insurance Limited',
            'client': self.client_record.id,
            'matter_type': MatterType.LITIGATION,
            'priority': MatterPriority.HIGH,
            'court': 'High Court of Kenya at Nairobi',
            'case_number': 'HCCC/E450/2026',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['matter_reference'].startswith('SP/'))
        self.assertEqual(response.data['status'], MatterStatus.NEW)

    def test_matter_status_change(self):
        matter = Matter.objects.create(
            title='Commercial Lease Review',
            client=self.client_record,
            assigned_advocate=self.advocate,
            created_by=self.advocate
        )
        url = reverse('matter-change-status', kwargs={'pk': matter.pk})
        response = self.client.post(url, {'status': MatterStatus.ACTIVE}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        matter.refresh_from_db()
        self.assertEqual(matter.status, MatterStatus.ACTIVE)

    def test_matter_delete_cascades_and_unlinks_documents(self):
        admin = User.objects.create_superuser(
            username='admin_peter',
            email='admin2@siwoloadvocates.com',
            password='Password123!',
            role=UserRole.ADMIN
        )
        matter = Matter.objects.create(
            title='Dispute Resolution',
            client=self.client_record,
            assigned_advocate=self.advocate,
            created_by=self.advocate
        )
        hearing = Hearing.objects.create(
            matter=matter,
            hearing_type='mention',
            hearing_date='2026-11-20T09:00:00Z',
            created_by=self.advocate
        )
        task = Task.objects.create(
            title='File Replying Affidavit',
            matter=matter,
            created_by=self.advocate
        )
        update = CaseUpdate.objects.create(
            matter=matter,
            title='Mention attended',
            description='Orders granted',
            author=self.advocate
        )
        doc = Document.objects.create(
            title='Replying Affidavit',
            client=self.client_record,
            matter=matter,
            storage_path='docs/test.pdf',
            original_filename='test.pdf',
            file_size_bytes=1024,
            uploaded_by=self.advocate
        )

        self.client.force_authenticate(user=admin)
        url = reverse('matter-detail', kwargs={'pk': matter.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Matter is deleted
        self.assertFalse(Matter.objects.filter(pk=matter.pk).exists())
        # Hearing, Task, CaseUpdate are deleted
        self.assertFalse(Hearing.objects.filter(pk=hearing.pk).exists())
        self.assertFalse(Task.objects.filter(pk=task.pk).exists())
        self.assertFalse(CaseUpdate.objects.filter(pk=update.pk).exists())
        # Document is KEPT but unlinked
        doc.refresh_from_db()
        self.assertIsNone(doc.matter)
        self.assertEqual(doc.client, self.client_record)

        # Audit log written
        audit = AuditLog.objects.filter(action=AuditAction.DELETE, module='MATTER').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details.get('name'), 'Dispute Resolution')

    def test_matter_update_records_audit_trail_changes(self):
        matter = Matter.objects.create(
            title='Corporate Merger',
            client=self.client_record,
            created_by=self.advocate
        )
        self.client.force_authenticate(user=self.advocate)
        url = reverse('matter-detail', kwargs={'pk': matter.pk})
        response = self.client.patch(url, {'priority': MatterPriority.URGENT}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit = AuditLog.objects.filter(action=AuditAction.UPDATE, module='MATTER', target_id=str(matter.pk)).first()
        self.assertIsNotNone(audit)
        self.assertIn('priority', audit.details.get('changes', {}))
        self.assertEqual(audit.details['changes']['priority']['new'], MatterPriority.URGENT)

    def test_matter_legacy_reference_and_duplicate_rejection(self):
        url = reverse('matter-list')
        data = {
            'matter_reference': 'LEGACY/OLD/2018/001',
            'title': 'Legacy Estate Case',
            'client': self.client_record.id,
            'matter_type': MatterType.FAMILY,
            'priority': MatterPriority.NORMAL,
            'location': 'Nakuru',
            'date_opened': '2018-02-01',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['matter_reference'], 'LEGACY/OLD/2018/001')
        self.assertEqual(response.data['location'], 'Nakuru')

        # Duplicate reference must be refused with clear error
        data2 = {
            'matter_reference': 'LEGACY/OLD/2018/001',
            'title': 'Another Case with Same Ref',
            'client': self.client_record.id,
        }
        dup_resp = self.client.post(url, data2, format='json')
        self.assertEqual(dup_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('matter_reference', dup_resp.data)
        self.assertIn('already exists', str(dup_resp.data['matter_reference']))

    def test_suggested_reference_increment_and_year_from_date_opened(self):
        # Create a matter with reference SP/Nairobi/CIV/14/2023
        Matter.objects.create(
            matter_reference='SP/Nairobi/CIV/14/2023',
            title='Existing Matter 14',
            client=self.client_record,
            location='Nairobi',
            created_by=self.advocate
        )

        # Call suggest_reference endpoint for Kisumu with date_opened in 2026
        sug_url = reverse('matter-suggest-reference')
        resp = self.client.get(sug_url, {'location': 'Kisumu', 'date_opened': '2026-05-10'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Next file number should be 15 (14 + 1), year 2026
        self.assertEqual(resp.data['suggested_reference'], 'SP/Kisumu//15/2026')

        # Year comes from date_opened, not today's date
        resp2 = self.client.get(sug_url, {'location': 'Mombasa', 'date_opened': '2021-11-01'})
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data['suggested_reference'], 'SP/Mombasa//15/2021')
