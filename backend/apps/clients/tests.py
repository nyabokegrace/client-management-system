from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client, ClientType, ClientStatus
from apps.audit.models import AuditLog, AuditAction


class ClientManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_jane',
            email='jane@siwololaw.co.ke',
            password='Password123!',
            first_name='Jane',
            last_name='Advocate',
            role=UserRole.ADVOCATE
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
