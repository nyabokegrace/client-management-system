from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, UserRole


class AccountsAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin_test',
            email='admin@siwololaw.co.ke',
            password='Password123!',
            first_name='Admin',
            last_name='User',
            role=UserRole.ADMIN
        )
        self.advocate_user = User.objects.create_user(
            username='advocate_test',
            email='advocate@siwololaw.co.ke',
            password='Password123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADVOCATE
        )

    def test_login_success(self):
        url = reverse('auth-login')
        response = self.client.post(url, {'username': 'admin_test', 'password': 'Password123!'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)
        self.assertEqual(response.data['user']['username'], 'admin_test')
        self.assertEqual(response.data['user']['role'], UserRole.ADMIN)

    def test_login_invalid_credentials(self):
        url = reverse('auth-login')
        response = self.client.post(url, {'username': 'admin_test', 'password': 'WrongPassword'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_current_user_me(self):
        self.client.force_authenticate(user=self.advocate_user)
        url = reverse('auth-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'advocate_test')
        self.assertEqual(response.data['role'], UserRole.ADVOCATE)

    def test_unauthenticated_access_denied(self):
        url = reverse('auth-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
