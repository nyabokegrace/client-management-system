from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter, MatterStatus, MatterPriority, MatterType


class MatterManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_peter',
            email='peter@siwololaw.co.ke',
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
        self.assertTrue(response.data['matter_reference'].startswith('SWL-'))
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
