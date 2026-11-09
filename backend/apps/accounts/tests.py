import os
from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from django.core.cache import cache
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from .models import User, UserRole


class AccountsAuthenticationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin_test',
            email='admin@siwoloadvocates.com',
            password='Password123!',
            first_name='Admin',
            last_name='User',
            role=UserRole.ADMIN
        )
        self.advocate_user = User.objects.create_user(
            username='advocate_test',
            email='advocate@siwoloadvocates.com',
            password='Password123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADVOCATE
        )

    def tearDown(self):
        cache.clear()

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
        self.assertIn('firm', response.data)
        self.assertEqual(response.data['firm']['firm_phone'], '+254792300520')

    def test_unauthenticated_access_denied(self):
        url = reverse('auth-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_profile_update(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('auth-me')
        patch_data = {
            'first_name': 'Peter O.',
            'last_name': 'Siwolo',
            'phone_number': '+254792300520',
            'email': 'info@siwoloadvocates.com',
        }
        response = self.client.patch(url, patch_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.admin_user.refresh_from_db()
        self.assertEqual(self.admin_user.first_name, 'Peter O.')
        self.assertEqual(self.admin_user.last_name, 'Siwolo')
        self.assertEqual(self.admin_user.phone_number, '+254792300520')
        self.assertEqual(self.admin_user.email, 'info@siwoloadvocates.com')

    def test_change_password(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('auth-change-password')
        response = self.client.post(url, {
            'old_password': 'Password123!',
            'new_password': 'NewStrongPassword@2026',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.check_password('NewStrongPassword@2026'))

    def test_firm_settings_endpoint(self):
        url = reverse('firm-settings')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['firm_name'], 'Siwolo P.O Law Advocates')
        self.assertEqual(response.data['advocate_title'], 'Principal Advocate and Founder')
        self.assertEqual(response.data['firm_email'], 'info@siwoloadvocates.com')
        self.assertEqual(response.data['firm_phone'], '+254792300520')

    def test_seed_cms_creates_single_user_from_env(self):
        User.objects.all().delete()
        with patch.dict(os.environ, {'INITIAL_ADMIN_PASSWORD': 'TestSeededPassword@2026'}):
            call_command('seed_cms')
        self.assertEqual(User.objects.count(), 1)
        user = User.objects.first()
        self.assertEqual(user.username, 'admin')
        self.assertEqual(user.email, 'info@siwoloadvocates.com')
        self.assertEqual(user.phone_number, '+254792300520')
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password('TestSeededPassword@2026'))

    def test_health_check_endpoint(self):
        url = reverse('health-check')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertEqual(response.data['service'], 'Siwolo P.O Law Advocates CMS')

    def test_expiring_token_authentication(self):
        token = Token.objects.create(user=self.admin_user)
        # Manually backdate token creation to 13 hours ago
        Token.objects.filter(pk=token.pk).update(created=timezone.now() - timedelta(hours=13))

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        url = reverse('auth-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('Token has expired', str(response.data))

    def test_login_burst_throttling(self):
        url = reverse('auth-login')
        # 5 failed login attempts
        for _ in range(5):
            res = self.client.post(url, {'username': 'admin_test', 'password': 'WrongPassword'}, format='json')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # 6th attempt should be throttled
        throttled_res = self.client.post(url, {'username': 'admin_test', 'password': 'WrongPassword'}, format='json')
        self.assertEqual(throttled_res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
