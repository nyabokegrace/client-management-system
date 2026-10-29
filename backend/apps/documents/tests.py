import tempfile
from pathlib import Path
from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter
from apps.documents.models import Document, DocumentCategory, ConfidentialityLevel
from apps.audit.models import AuditLog, AuditAction


class DocumentManagementTests(TestCase):
    def setUp(self):
        self.temp_storage = tempfile.TemporaryDirectory()
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_main',
            email='adv@siwololaw.co.ke',
            password='Password123!',
            first_name='Lead',
            last_name='Advocate',
            role=UserRole.ADVOCATE
        )
        self.staff_user = User.objects.create_user(
            username='staff_test',
            email='staff@siwololaw.co.ke',
            password='Password123!',
            first_name='Clerk',
            last_name='User',
            role=UserRole.STAFF
        )
        self.client_record = Client.objects.create(
            first_name='Mary',
            last_name='Otieno',
            phone_number='+254733333333',
            assigned_advocate=self.advocate
        )
        self.matter = Matter.objects.create(
            title='Mary Otieno Succession Cause',
            client=self.client_record,
            assigned_advocate=self.advocate
        )
        self.client.force_authenticate(user=self.advocate)

    def tearDown(self):
        self.temp_storage.cleanup()

    def test_document_upload_and_download(self):
        with override_settings(PRIVATE_STORAGE_ROOT=self.temp_storage.name):
            url = reverse('document-list')
            dummy_file = SimpleUploadedFile("pleading.pdf", b"%PDF-1.4 sample legal pleading content", content_type="application/pdf")
            data = {
                'title': 'Originating Summons',
                'category': DocumentCategory.PLEADINGS,
                'client': self.client_record.id,
                'matter': self.matter.id,
                'file': dummy_file
            }
            response = self.client.post(url, data, format='multipart')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            doc_id = response.data['id']

            # Download document
            download_url = reverse('document-download', kwargs={'pk': doc_id})
            dl_response = self.client.get(download_url)
            self.assertEqual(dl_response.status_code, status.HTTP_200_OK)
            self.assertIn('attachment', dl_response.headers.get('Content-Disposition', ''))

            # Verify audit trail recorded the download
            audit = AuditLog.objects.filter(action=AuditAction.DOWNLOAD, target_id=str(doc_id)).first()
            self.assertIsNotNone(audit)

    def test_restricted_document_access_denied_for_unauthorized_staff(self):
        with override_settings(PRIVATE_STORAGE_ROOT=self.temp_storage.name):
            # Create a restricted document
            dummy_file = SimpleUploadedFile("confidential_settlement.pdf", b"Confidential Settlement", content_type="application/pdf")
            url = reverse('document-list')
            data = {
                'title': 'Confidential Settlement Proposal',
                'category': DocumentCategory.GENERAL,
                'confidentiality': ConfidentialityLevel.RESTRICTED,
                'client': self.client_record.id,
                'matter': self.matter.id,
                'file': dummy_file
            }
            create_resp = self.client.post(url, data, format='multipart')
            self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
            doc_id = create_resp.data['id']

            # Authenticate as unrelated staff
            self.client.force_authenticate(user=self.staff_user)
            download_url = reverse('document-download', kwargs={'pk': doc_id})
            dl_resp = self.client.get(download_url)
            self.assertEqual(dl_resp.status_code, status.HTTP_403_FORBIDDEN)
