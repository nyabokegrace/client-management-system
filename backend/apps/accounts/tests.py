import os
from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.cache import cache
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from django_otp.plugins.otp_totp.models import TOTPDevice
from django_otp.oath import totp
from .models import User, UserRole, RecoveryCode
from apps.audit.models import AuditLog, AuditAction


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
        self.assertNotIn('token', response.data)

    def test_current_user_me(self):
        token = Token.objects.create(user=self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        url = reverse('auth-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'admin_test')
        self.assertEqual(response.data['email'], 'admin@siwoloadvocates.com')
        self.assertEqual(response.data['role'], UserRole.ADMIN)
        self.assertIn('firm', response.data)

    def test_unauthenticated_access_denied(self):
        url = reverse('auth-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_profile_update(self):
        token = Token.objects.create(user=self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        url = reverse('auth-me')
        response = self.client.patch(url, {
            'first_name': 'Updated',
            'last_name': 'Admin',
            'phone_number': '+254700000000'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'Updated')
        self.assertEqual(response.data['last_name'], 'Admin')
        self.assertEqual(response.data['phone_number'], '+254700000000')

    def test_change_password(self):
        token = Token.objects.create(user=self.admin_user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        url = reverse('auth-change-password')
        response = self.client.post(url, {
            'old_password': 'Password123!',
            'new_password': 'NewPassword123!'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.check_password('NewPassword123!'))

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
        with patch.dict(os.environ, {'INITIAL_ADMIN_PASSWORD': 'SingleAdminPassword2026!'}):
            call_command('seed_cms')

        admin = User.objects.filter(username='admin').first()
        self.assertIsNotNone(admin)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.check_password('SingleAdminPassword2026!'))

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

    def test_setup_status_endpoint(self):
        url = reverse('auth-setup-status')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_users'])
        self.assertEqual(response.data['firm_name'], 'Siwolo P.O Law Advocates')


class AuthenticationAuditTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='peter_siwolo',
            email='peter@siwoloadvocates.com',
            password='Password123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADMIN
        )

    def tearDown(self):
        cache.clear()

    def test_logout_audit_logged(self):
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        logout_url = reverse('auth-logout')
        res = self.client.post(logout_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        actions = list(AuditLog.objects.filter(actor=self.user).values_list('action', flat=True))
        self.assertIn(AuditAction.SIGN_OUT, actions)

    def test_audit_log_never_records_code_or_password(self):
        # Trigger failed login attempt
        login_url = reverse('auth-login')
        self.client.post(login_url, {'username': 'peter_siwolo', 'password': 'SuperSecretPasswordXYZ'}, format='json')

        # Check all audit logs
        logs = AuditLog.objects.all()
        for log in logs:
            self.assertNotIn('SuperSecretPasswordXYZ', log.target_repr)
            self.assertNotIn('SuperSecretPasswordXYZ', str(log.details))


class RecoveryCodesTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='siwolo_counsel',
            email='counsel@siwoloadvocates.com',
            password='InitialPassword123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADMIN
        )

    def test_generate_recovery_codes_requires_auth(self):
        url = reverse('auth-generate-recovery-codes')
        res = self.client.post(url, {'password': 'InitialPassword123!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_generate_recovery_codes_wrong_password(self):
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        url = reverse('auth-generate-recovery-codes')
        res = self.client.post(url, {'password': 'WrongPassword999!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Incorrect password', res.data['error'])

    def test_generate_recovery_codes_success_and_invalidation(self):
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        url = reverse('auth-generate-recovery-codes')

        # First generation: returns 8 codes
        res1 = self.client.post(url, {'password': 'InitialPassword123!'}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res1.data['recovery_codes']), 8)
        self.assertEqual(res1.data['count'], 8)
        first_codes = res1.data['recovery_codes']

        # Verify format (XXXX-XXXX)
        for code in first_codes:
            self.assertRegex(code, r'^[A-F0-9]{4}-[A-F0-9]{4}$')

        # Active codes count in DB should be 8
        self.assertEqual(RecoveryCode.objects.filter(user=self.user, consumed_at__isnull=True).count(), 8)

        # Count endpoint
        count_url = reverse('auth-recovery-codes-count')
        count_res = self.client.get(count_url)
        self.assertEqual(count_res.status_code, status.HTTP_200_OK)
        self.assertEqual(count_res.data['remaining'], 8)

        # Second generation invalidates first set
        res2 = self.client.post(url, {'password': 'InitialPassword123!'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        second_codes = res2.data['recovery_codes']
        self.assertEqual(len(second_codes), 8)

        # Only 8 active codes should exist in DB
        self.assertEqual(RecoveryCode.objects.filter(user=self.user).count(), 8)
        for old_code in first_codes:
            ok, _ = RecoveryCode.verify_and_consume(self.user, old_code)
            self.assertFalse(ok)


class FirstRunSetupTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    @override_settings(SETUP_CODE='siwolo-firm-setup-secret-code-2026')
    def test_setup_status_endpoint(self):
        # 1. Zero users: setup is needed
        User.objects.all().delete()
        res_empty = self.client.get(reverse('auth-setup-status'))
        self.assertEqual(res_empty.status_code, status.HTTP_200_OK)
        self.assertTrue(res_empty.data['is_setup_required'])
        self.assertFalse(res_empty.data['has_users'])

        # 2. When user exists: setup is not needed
        User.objects.create_user(
            username='counsel',
            email='counsel@siwoloadvocates.com',
            password='TestPassword123!',
            role=UserRole.ADMIN
        )
        res_has_user = self.client.get(reverse('auth-setup-status'))
        self.assertEqual(res_has_user.status_code, status.HTTP_200_OK)
        self.assertFalse(res_has_user.data['is_setup_required'])
        self.assertTrue(res_has_user.data['has_users'])

    @override_settings(SETUP_CODE='siwolo-firm-setup-secret-code-2026')
    def test_setup_refused_when_user_exists(self):
        User.objects.create_user(
            username='counsel',
            email='counsel@siwoloadvocates.com',
            password='TestPassword123!',
            role=UserRole.ADMIN
        )
        res = self.client.post(reverse('auth-setup'), {
            'setup_code': 'siwolo-firm-setup-secret-code-2026',
            'name': 'Peter Siwolo',
            'email': 'peter@siwoloadvocates.com',
            'password': 'BrandNewPassword123!'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('permanently closed', res.data['error'])

    @override_settings(SETUP_CODE=None)
    def test_setup_disabled_when_setup_code_not_set(self):
        User.objects.all().delete()
        res = self.client.post(reverse('auth-setup'), {
            'setup_code': 'some-guess',
            'name': 'Peter Siwolo',
            'email': 'peter@siwoloadvocates.com',
            'password': 'BrandNewPassword123!'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('disabled', res.data['error'])

    @override_settings(SETUP_CODE='siwolo-firm-setup-secret-code-2026')
    def test_setup_wrong_code(self):
        User.objects.all().delete()
        res = self.client.post(reverse('auth-setup'), {
            'setup_code': 'incorrect-code-attempt',
            'name': 'Peter Siwolo',
            'email': 'peter@siwoloadvocates.com',
            'password': 'BrandNewPassword123!'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid setup', res.data['error'])

    @override_settings(SETUP_CODE='siwolo-firm-setup-secret-code-2026')
    def test_setup_creates_user_and_unconfirmed_totp_device_with_otpauth_url(self):
        User.objects.all().delete()
        res = self.client.post(reverse('auth-setup'), {
            'setup_code': 'siwolo-firm-setup-secret-code-2026',
            'name': 'Peter O. Siwolo',
            'email': 'info@siwoloadvocates.com',
            'password': 'BrandNewPassword123!',
            'username': 'admin'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('otpauth_url', res.data)
        self.assertTrue(res.data['otpauth_url'].startswith('otpauth://totp/'))
        self.assertNotIn('token', res.data)  # Auth token is NOT issued before confirmation

        # Verify DB records
        user = User.objects.get(username='admin')
        self.assertTrue(user.is_superuser)
        self.assertEqual(user.role, UserRole.ADMIN)
        self.assertEqual(user.first_name, 'Peter')
        self.assertEqual(user.last_name, 'O. Siwolo')
        device = TOTPDevice.objects.get(user=user)
        self.assertFalse(device.confirmed)

    @override_settings(SETUP_CODE='siwolo-firm-setup-secret-code-2026')
    def test_setup_enforces_password_min_length(self):
        User.objects.all().delete()
        res = self.client.post(reverse('auth-setup'), {
            'setup_code': 'siwolo-firm-setup-secret-code-2026',
            'name': 'Peter Siwolo',
            'email': 'peter@siwoloadvocates.com',
            'password': 'Short1!'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), 0)

    @override_settings(SETUP_CODE='siwolo-firm-setup-secret-code-2026')
    def test_setup_confirm_success(self):
        User.objects.all().delete()
        # 1. Initial setup
        setup_res = self.client.post(reverse('auth-setup'), {
            'setup_code': 'siwolo-firm-setup-secret-code-2026',
            'name': 'Peter O. Siwolo',
            'email': 'info@siwoloadvocates.com',
            'password': 'BrandNewPassword123!',
        }, format='json')
        self.assertEqual(setup_res.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(id=setup_res.data['user_id'])
        self.assertEqual(user.username, 'admin')
        device = TOTPDevice.objects.get(user=user, confirmed=False)

        # 2. Generate valid TOTP token
        valid_totp = str(totp(device.bin_key)).zfill(6)

        # 3. Confirm endpoint
        confirm_res = self.client.post(reverse('auth-setup-confirm'), {
            'user_id': user.id,
            'code': valid_totp,
        }, format='json')
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)
        self.assertIn('token', confirm_res.data)
        self.assertIn('recovery_codes', confirm_res.data)
        self.assertEqual(len(confirm_res.data['recovery_codes']), 8)
        self.assertEqual(confirm_res.data['user']['advocate_title'], 'Principal Advocate and Founder')

        # Device is confirmed
        device.refresh_from_db()
        self.assertTrue(device.confirmed)

        # Recovery codes generated and stored
        self.assertEqual(RecoveryCode.objects.filter(user=user, consumed_at__isnull=True).count(), 8)

        # Audit logged
        actions = list(AuditLog.objects.filter(actor=user).values_list('action', flat=True))
        self.assertIn(AuditAction.CODE_VERIFIED, actions)
        self.assertIn(AuditAction.SIGN_IN_SUCCEEDED, actions)

    @override_settings(SETUP_CODE='siwolo-firm-setup-secret-code-2026')
    def test_setup_confirm_invalid_code(self):
        User.objects.all().delete()
        setup_res = self.client.post(reverse('auth-setup'), {
            'setup_code': 'siwolo-firm-setup-secret-code-2026',
            'name': 'Peter O. Siwolo',
            'email': 'info@siwoloadvocates.com',
            'password': 'BrandNewPassword123!',
        }, format='json')
        self.assertEqual(setup_res.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(id=setup_res.data['user_id'])
        device = TOTPDevice.objects.get(user=user)

        confirm_res = self.client.post(reverse('auth-setup-confirm'), {
            'user_id': user.id,
            'code': '000000',
        }, format='json')
        self.assertEqual(confirm_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid verification code', confirm_res.data['error'])
        self.assertNotIn('token', confirm_res.data)

        device.refresh_from_db()
        self.assertFalse(device.confirmed)

    @override_settings(SETUP_CODE='siwolo-firm-setup-secret-code-2026')
    def test_setup_confirm_already_confirmed_rejected(self):
        User.objects.all().delete()
        setup_res = self.client.post(reverse('auth-setup'), {
            'setup_code': 'siwolo-firm-setup-secret-code-2026',
            'name': 'Peter O. Siwolo',
            'email': 'info@siwoloadvocates.com',
            'password': 'BrandNewPassword123!',
        }, format='json')
        self.assertEqual(setup_res.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(id=setup_res.data['user_id'])
        device = TOTPDevice.objects.get(user=user)
        device.confirmed = True
        device.save()

        confirm_res = self.client.post(reverse('auth-setup-confirm'), {
            'user_id': user.id,
            'code': '123456',
        }, format='json')
        self.assertEqual(confirm_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been completed', confirm_res.data['error'])
