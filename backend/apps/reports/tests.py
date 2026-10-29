from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter


class ReportsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_reports',
            email='reports@siwololaw.co.ke',
            password='Password123!',
            first_name='Analyst',
            last_name='Advocate',
            role=UserRole.ADVOCATE
        )
        self.client_rec = Client.objects.create(first_name='Samuel', last_name='Mwangi', phone_number='+254700112233')
        Matter.objects.create(title='Mwangi Land Injunction', client=self.client_rec, assigned_advocate=self.advocate)
        self.client.force_authenticate(user=self.advocate)

    def test_dashboard_summary_endpoint(self):
        url = reverse('report-dashboard')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('kpis', response.data)
        self.assertEqual(response.data['kpis']['registered_clients'], 1)
        self.assertEqual(response.data['kpis']['active_matters'], 1)

    def test_csv_export_matters(self):
        url = reverse('report-export')
        response = self.client.get(url, {'type': 'matters'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename="matters_report.csv"', response['Content-Disposition'])
        self.assertIn('Matter Reference', response.content.decode('utf-8'))
