from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client, ClientType, ClientStatus
from apps.matters.models import Matter
from apps.audit.models import AuditLog, AuditAction


class ClientManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_jane',
            email='jane@siwoloadvocates.com',
            password='Password123!',
            first_name='Jane',
            last_name='Advocate',
            role=UserRole.ADVOCATE
        )
        self.admin = User.objects.create_superuser(
            username='admin_siwolo',
            email='admin@siwoloadvocates.com',
            password='Password123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADMIN
        )
        self.client.force_authenticate(user=self.advocate)

    def test_create_individual_client(self):
        url = reverse('client-list')
        data = {
            'client_type': ClientType.INDIVIDUAL,
            'first_name': 'Grace',
            'last_name': 'Wanjiru',
            'national_id': '12345678',
            'phone_number': '+254712345678',
            'email': 'grace@example.com',
            'postal_address': 'P.O. Box 100 Nairobi',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['client_reference'].startswith('CLI-'))
        self.assertEqual(response.data['display_name'], 'Grace Wanjiru')

        # Verify audit log was written
        audit = AuditLog.objects.filter(action=AuditAction.CREATE, module='CLIENT').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.actor, self.advocate)

    def test_organization_client_validation(self):
        url = reverse('client-list')
        data = {
            'client_type': ClientType.ORGANIZATION,
            'phone_number': '+254700000000',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('organization_name', response.data)

    def test_archive_client(self):
        cli = Client.objects.create(
            first_name='John',
            last_name='Doe',
            phone_number='+254711111111',
            created_by=self.advocate
        )
        url = reverse('client-archive', kwargs={'pk': cli.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cli.refresh_from_db()
        self.assertEqual(cli.status, ClientStatus.ARCHIVED)

    def test_client_delete_blocked_when_matters_exist(self):
        cli = Client.objects.create(
            first_name='Peter',
            last_name='Mwangi',
            phone_number='+254711222333',
            created_by=self.advocate
        )
        Matter.objects.create(
            title='Mwangi Land Dispute',
            client=cli,
            created_by=self.advocate
        )
        self.client.force_authenticate(user=self.admin)
        url = reverse('client-detail', kwargs={'pk': cli.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('error'), 'Delete or reassign this client\'s matters first')
        self.assertTrue(Client.objects.filter(pk=cli.pk).exists())

    def test_client_delete_succeeds_when_no_matters(self):
        cli = Client.objects.create(
            first_name='Samuel',
            last_name='Otieno',
            phone_number='+254733444555',
            created_by=self.advocate
        )
        self.client.force_authenticate(user=self.admin)
        url = reverse('client-detail', kwargs={'pk': cli.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Client.objects.filter(pk=cli.pk).exists())
        audit = AuditLog.objects.filter(action=AuditAction.DELETE, module='CLIENT').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details.get('name'), 'Samuel Otieno')

    def test_client_update_records_audit_trail_changes(self):
        cli = Client.objects.create(
            first_name='Lucy',
            last_name='Wanjiku',
            phone_number='+254711000111',
            created_by=self.advocate
        )
        self.client.force_authenticate(user=self.advocate)
        url = reverse('client-detail', kwargs={'pk': cli.pk})
        response = self.client.patch(url, {'phone_number': '+254799888777'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit = AuditLog.objects.filter(action=AuditAction.UPDATE, module='CLIENT', target_id=str(cli.pk)).first()
        self.assertIsNotNone(audit)
        self.assertIn('phone_number', audit.details.get('changes', {}))
        self.assertEqual(audit.details['changes']['phone_number']['old'], '+254711000111')
        self.assertEqual(audit.details['changes']['phone_number']['new'], '+254799888777')
