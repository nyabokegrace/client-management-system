from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.tasks.models import Task, TaskPriority, TaskStatus


class TaskTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_tasks',
            email='tasks@siwololaw.co.ke',
            password='Password123!',
            first_name='Lead',
            last_name='Counsel',
            role=UserRole.ADVOCATE
        )
        self.client.force_authenticate(user=self.advocate)

    def test_create_and_complete_task(self):
        url = reverse('task-list')
        due = timezone.now() + timedelta(days=2)
        data = {
            'title': 'Draft Witness Statement',
            'priority': TaskPriority.HIGH,
            'status': TaskStatus.TODO,
            'due_date': due.isoformat(),
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task_id = response.data['id']

        # Complete task
        complete_url = reverse('task-complete', kwargs={'pk': task_id})
        complete_resp = self.client.post(complete_url)
        self.assertEqual(complete_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(complete_resp.data['task']['status'], TaskStatus.COMPLETED)
        self.assertIsNotNone(complete_resp.data['task']['completed_at'])

    def test_overdue_task_detection(self):
        past_date = timezone.now() - timedelta(days=2)
        task = Task.objects.create(
            title='Overdue Submissions Filing',
            priority=TaskPriority.URGENT,
            status=TaskStatus.TODO,
            due_date=past_date,
            created_by=self.advocate
        )
        self.assertTrue(task.is_overdue)

        url = reverse('task-overdue')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(t['id'] == task.id for t in response.data))
