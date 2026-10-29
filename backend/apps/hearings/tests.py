from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter
from apps.hearings.models import Hearing, HearingType, HearingStatus


class HearingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_hearings',
            email='hearings@siwololaw.co.ke',
            password='Password123!',
            first_name='Court',
            last_name='Counsel',
            role=UserRole.ADVOCATE
        )
        self.client_record = Client.objects.create(first_name='Ali', last_name='Hassan', phone_number='+254700000001')
        self.matter = Matter.objects.create(title='Hassan Commercial Dispute', client=self.client_record, court='Commercial Court Milimani')
        self.client.force_authenticate(user=self.advocate)

    def test_schedule_hearing_and_record_outcome(self):
        url = reverse('hearing-list')
        future_date = timezone.now() + timedelta(days=7)
        data = {
            'matter': self.matter.id,
            'hearing_type': HearingType.MENTION,
            'hearing_date': future_date.isoformat(),
            'court': 'Court 4 Milimani',
            'location_details': 'Virtual via MS Teams',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        hearing_id = response.data['id']

        # Record outcome
        outcome_url = reverse('hearing-record-outcome', kwargs={'pk': hearing_id})
        outcome_resp = self.client.post(outcome_url, {
            'outcome_summary': 'Mention conducted; court granted 14 days to file replying affidavit.',
            'next_hearing_date': (future_date + timedelta(days=14)).isoformat()
        }, format='json')
        self.assertEqual(outcome_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(outcome_resp.data['status'], HearingStatus.COMPLETED)
