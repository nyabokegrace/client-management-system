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
from apps.tasks.models import Task, TaskStatus, TaskPriority
from apps.case_updates.models import CaseUpdate, UpdateCategory


class CaseUpdateWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username='siwolo_admin',
            email='info@siwoloadvocates.com',
            password='Password123!',
            first_name='Siwolo',
            last_name='P.O',
            role=UserRole.ADMIN
        )
        self.client.force_authenticate(user=self.admin)

        self.client_record = Client.objects.create(
            first_name='Grace',
            last_name='Wanjiru',
            phone_number='+254711223344',
            email='grace@example.com'
        )
        self.matter = Matter.objects.create(
            matter_reference='SP/Nairobi/CIV/1/2026',
            title='Wanjiru Property Succession',
            client=self.client_record,
            court='Milimani High Court',
            case_number='HCCC/123/2026',
            assigned_advocate=self.admin
        )

    def test_acceptance_walkthrough_mention_appearance_creates_hearing_and_tasks(self):
        """
        Acceptance walkthrough: Siwolo attends a mention. He adds a Court Appearance update,
        picks the mention from the dropdown, fills in next hearing 15 Dec 9:00 am and two orders
        with deadlines. Saving completes the mention, creates the 15 Dec hearing, and creates both tasks.
        The dashboard shows the 15 Dec hearing under Upcoming Hearings and the two tasks under Action Tasks.
        """
        # 1. Existing scheduled mention
        mention = Hearing.objects.create(
            matter=self.matter,
            hearing_type=HearingType.MENTION,
            hearing_date='2026-11-09T09:00:00+03:00',
            court='Milimani High Court',
            court_case_number='HCCC/123/2026',
            status=HearingStatus.SCHEDULED,
            assigned_advocate=self.admin,
            created_by=self.admin
        )

        # 2. Add Court Appearance update
        url = reverse('case-update-list')
        payload = {
            'matter': self.matter.id,
            'hearing': mention.id,
            'category': UpdateCategory.COURT_APPEARANCE,
            'title': 'Mention attended before Justice Mwangi',
            'description': 'Court directed parties to file agreed issues and fix hearing date.',
            'event_datetime': '2026-11-09T09:30:00+03:00',
            'share_with_client': True,
            'next_court_date': {
                'hearing_date': '2026-12-15T09:00',
                'hearing_type': HearingType.MENTION,
                'court': 'Milimani High Court'
            },
            'orders': [
                {
                    'description': 'File agreed issues for trial',
                    'due_date': '2026-11-30T17:00'
                },
                {
                    'description': 'Serve trial bundle on opposing counsel',
                    'due_date': '2026-12-05T17:00'
                }
            ]
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        update_id = response.data['id']

        # Verify old mention is completed with outcome summary
        mention.refresh_from_db()
        self.assertEqual(mention.status, HearingStatus.COMPLETED)
        self.assertEqual(mention.outcome_summary, 'Court directed parties to file agreed issues and fix hearing date.')

        # Verify new 15 Dec hearing was created and linked
        new_hearings = Hearing.objects.filter(originating_update_id=update_id)
        self.assertEqual(new_hearings.count(), 1)
        next_h = new_hearings.first()
        self.assertEqual(next_h.status, HearingStatus.SCHEDULED)
        self.assertEqual(next_h.hearing_type, HearingType.MENTION)
        self.assertEqual(next_h.court, 'Milimani High Court')
        self.assertEqual(next_h.hearing_date.month, 12)
        self.assertEqual(next_h.hearing_date.day, 15)

        # Verify both tasks were created and linked
        created_tasks = Task.objects.filter(originating_update_id=update_id).order_by('due_date')
        self.assertEqual(created_tasks.count(), 2)
        self.assertEqual(created_tasks[0].title, 'File agreed issues for trial')
        self.assertEqual(created_tasks[1].title, 'Serve trial bundle on opposing counsel')

        # Verify dashboard shows the 15 Dec hearing under Upcoming Hearings and tasks under Action Tasks
        dashboard_url = reverse('report-dashboard')
        dash_resp = self.client.get(dashboard_url)
        self.assertEqual(dash_resp.status_code, status.HTTP_200_OK)

        upcoming = dash_resp.data['upcoming_hearings']
        self.assertTrue(any(h['id'] == next_h.id for h in upcoming))

        pending_tasks = dash_resp.data['tasks_requiring_attention']
        task_ids = [t['id'] for t in pending_tasks]
        self.assertIn(created_tasks[0].id, task_ids)
        self.assertIn(created_tasks[1].id, task_ids)

    def test_share_with_client_defaults_and_internal_review(self):
        # Default is True
        update1 = CaseUpdate.objects.create(
            matter=self.matter,
            title='General client notice',
            description='Documents served',
            category=UpdateCategory.GENERAL,
            author=self.admin
        )
        self.assertTrue(update1.share_with_client)

        # Internal review is automatically False
        url = reverse('case-update-list')
        res = self.client.post(url, {
            'matter': self.matter.id,
            'title': 'Internal Case Strategy',
            'description': 'Review strength of replying affidavit arguments',
            'category': UpdateCategory.INTERNAL_REVIEW,
            'share_with_client': True, # Attempting True should be forced False
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res.data['share_with_client'])

    def test_record_outcome_creates_new_scheduled_hearing(self):
        mention = Hearing.objects.create(
            matter=self.matter,
            hearing_type=HearingType.MENTION,
            hearing_date='2026-11-10T10:00:00+03:00',
            court='Milimani High Court',
            status=HearingStatus.SCHEDULED,
            assigned_advocate=self.admin
        )

        outcome_url = reverse('hearing-record-outcome', kwargs={'pk': mention.id})
        res = self.client.post(outcome_url, {
            'outcome_summary': 'Orders taken. Next hearing fixed for 20 Jan 2027.',
            'next_hearing_date': '2027-01-20T09:00',
            'next_hearing_type': HearingType.TRIAL,
            'court': 'Milimani High Court Court 5'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        mention.refresh_from_db()
        self.assertEqual(mention.status, HearingStatus.COMPLETED)

        # New hearing created
        new_h = Hearing.objects.filter(matter=self.matter, status=HearingStatus.SCHEDULED).latest('id')
        self.assertEqual(new_h.hearing_type, HearingType.TRIAL)
        self.assertEqual(new_h.court, 'Milimani High Court Court 5')

    def test_delete_update_removes_linked_when_requested(self):
        url = reverse('case-update-list')
        res = self.client.post(url, {
            'matter': self.matter.id,
            'category': UpdateCategory.COURT_APPEARANCE,
            'title': 'Hearing attended',
            'description': 'Court ordered submissions',
            'next_court_date': {'hearing_date': '2026-12-01T10:00', 'hearing_type': HearingType.MENTION},
            'orders': [{'description': 'File submissions', 'due_date': '2026-11-25T17:00'}]
        }, format='json')
        update_id = res.data['id']

        # Delete with remove_linked=true
        del_url = reverse('case-update-detail', kwargs={'pk': update_id}) + '?remove_linked=true'
        del_res = self.client.delete(del_url)
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

        self.assertFalse(CaseUpdate.objects.filter(pk=update_id).exists())
        self.assertFalse(Hearing.objects.filter(originating_update_id=update_id).exists())
        self.assertFalse(Task.objects.filter(originating_update_id=update_id).exists())

    def test_edit_update_syncs_linked_hearing_and_tasks(self):
        url = reverse('case-update-list')
        res = self.client.post(url, {
            'matter': self.matter.id,
            'category': UpdateCategory.COURT_APPEARANCE,
            'title': 'Hearing attended',
            'description': 'Court ordered submissions',
            'next_court_date': {'hearing_date': '2026-12-01T10:00', 'hearing_type': HearingType.MENTION},
            'orders': [{'description': 'File submissions', 'due_date': '2026-11-25T17:00'}]
        }, format='json')
        update_id = res.data['id']
        linked_task = Task.objects.get(originating_update_id=update_id)

        # Edit update: change next court date and task
        edit_url = reverse('case-update-detail', kwargs={'pk': update_id})
        edit_res = self.client.put(edit_url, {
            'matter': self.matter.id,
            'category': UpdateCategory.COURT_APPEARANCE,
            'title': 'Hearing attended - updated',
            'description': 'Court ordered submissions by extended deadline',
            'update_linked_records': True,
            'next_court_date': {'hearing_date': '2026-12-10T11:00', 'hearing_type': HearingType.MENTION},
            'orders': [{'id': linked_task.id, 'description': 'File submissions (extended)', 'due_date': '2026-12-02T17:00'}]
        }, format='json')
        self.assertEqual(edit_res.status_code, status.HTTP_200_OK)

        linked_h = Hearing.objects.get(originating_update_id=update_id)
        self.assertEqual(linked_h.hearing_date.day, 10)

        linked_task.refresh_from_db()
        self.assertEqual(linked_task.title, 'File submissions (extended)')
        self.assertEqual(linked_task.due_date.day, 2)

