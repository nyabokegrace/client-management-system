import os
from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from django.core.cache import cache
from django.core.management import call_command
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from .models import User, UserRole, LoginChallenge, ChallengePurpose
from apps.audit.models import AuditLog, AuditAction
from .emails import (
    generate_six_digit_code,
    hash_code,
    verify_code_hash,
    mask_email,
    send_verification_email,
    check_hourly_email_limit,
)


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
        with self.settings(REQUIRE_2FA=False):
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

    def test_setup_status_endpoint(self):
        url = reverse('auth-setup-status')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_users'])
        self.assertEqual(response.data['firm_name'], 'Siwolo P.O Law Advocates')

    def test_signup_success_and_login_flow(self):
        signup_url = reverse('auth-signup')
        signup_payload = {
            'name': 'Peter O. Siwolo',
            'username': 'siwolo_counsel',
            'password': 'StrongSecurePassword@2026',
        }
        signup_response = self.client.post(signup_url, signup_payload, format='json')
        self.assertEqual(signup_response.status_code, status.HTTP_201_CREATED)
        self.assertIn('Account created successfully', signup_response.data['message'])
        self.assertEqual(signup_response.data['username'], 'siwolo_counsel')

        # Verify user was created with correct fields
        created_user = User.objects.get(username='siwolo_counsel')
        self.assertEqual(created_user.first_name, 'Peter O.')
        self.assertEqual(created_user.last_name, 'Siwolo')
        self.assertEqual(created_user.full_name, 'Peter O. Siwolo')
        self.assertEqual(created_user.role, UserRole.ADMIN)
        self.assertTrue(created_user.is_superuser)
        self.assertTrue(created_user.check_password('StrongSecurePassword@2026'))

        # Log in with the exact same username and password used to sign up (with REQUIRE_2FA=False for direct token check)
        with self.settings(REQUIRE_2FA=False):
            login_url = reverse('auth-login')
            login_response = self.client.post(login_url, {
                'username': 'siwolo_counsel',
                'password': 'StrongSecurePassword@2026',
            }, format='json')
            self.assertEqual(login_response.status_code, status.HTTP_200_OK)
            self.assertIn('token', login_response.data)
            self.assertEqual(login_response.data['user']['username'], 'siwolo_counsel')
            self.assertEqual(login_response.data['user']['full_name'], 'Peter O. Siwolo')

    def test_signup_duplicate_username(self):
        url = reverse('auth-signup')
        response = self.client.post(url, {
            'name': 'Duplicate User',
            'username': 'admin_test',
            'password': 'StrongSecurePassword@2026',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_signup_short_password(self):
        url = reverse('auth-signup')
        response = self.client.post(url, {
            'name': 'Peter Siwolo',
            'username': 'new_advocate',
            'password': 'short',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_signup_blank_name(self):
        url = reverse('auth-signup')
        response = self.client.post(url, {
            'name': '   ',
            'username': 'new_advocate_2',
            'password': 'StrongSecurePassword@2026',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)


class StageAEmailAndChallengeTests(TestCase):
    def setUp(self):
        mail.outbox.clear()
        self.user = User.objects.create_user(
            username='siwolo_test',
            email='counsel@siwoloadvocates.com',
            password='TestPassword123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADMIN
        )

    def tearDown(self):
        mail.outbox.clear()

    def test_code_generation_format_and_hashing(self):
        code = generate_six_digit_code()
        self.assertEqual(len(code), 6)
        self.assertTrue(code.isdigit())

        hashed = hash_code(code)
        self.assertEqual(len(hashed), 64)  # sha256 hex length
        self.assertTrue(verify_code_hash(code, hashed))
        self.assertFalse(verify_code_hash('999999', hashed) if code != '999999' else False)

    def test_mask_email(self):
        self.assertEqual(mask_email('info@siwoloadvocates.com'), 'i***@siwoloadvocates.com')
        self.assertEqual(mask_email('peter.siwolo@siwoloadvocates.com'), 'p***@siwoloadvocates.com')
        self.assertEqual(mask_email('a@domain.com'), 'a***@domain.com')

    def test_verification_email_content(self):
        code = '123456'
        ok, err = send_verification_email('counsel@siwoloadvocates.com', code, purpose='login', ttl_minutes=10)
        self.assertTrue(ok)
        self.assertEqual(len(mail.outbox), 1)

        email = mail.outbox[0]
        self.assertEqual(email.subject, "Your Siwolo CMS verification code")
        self.assertIn("123456", email.body)
        self.assertIn("10 minutes", email.body)
        self.assertIn("If you did not request this verification code", email.body)
        # Check no links
        self.assertNotIn("http://", email.body)
        self.assertNotIn("https://", email.body)
        # Check HTML alternative
        self.assertEqual(len(email.alternatives), 1)
        self.assertEqual(email.alternatives[0][1], "text/html")
        self.assertNotIn("http://", email.alternatives[0][0])
        self.assertNotIn("https://", email.alternatives[0][0])

    def test_challenge_creation_and_success_flow(self):
        challenge, code, sent_ok, _ = LoginChallenge.create_challenge(
            user=self.user,
            purpose=ChallengePurpose.LOGIN,
            ttl_minutes=10
        )
        self.assertIsNotNone(challenge)
        self.assertTrue(sent_ok)
        self.assertEqual(challenge.target_email, 'counsel@siwoloadvocates.com')
        self.assertEqual(challenge.attempts, 0)
        self.assertIsNone(challenge.consumed_at)
        self.assertTrue(challenge.is_valid)

        # Verify with correct code
        ok, msg = challenge.verify(code)
        self.assertTrue(ok)
        challenge.refresh_from_db()
        self.assertTrue(challenge.is_consumed)
        self.assertFalse(challenge.is_valid)

    def test_challenge_five_wrong_attempts_locks(self):
        challenge, code, _, _ = LoginChallenge.create_challenge(
            user=self.user,
            purpose=ChallengePurpose.LOGIN
        )
        for i in range(4):
            ok, msg = challenge.verify('000000' if code != '000000' else '111111')
            self.assertFalse(ok)
            self.assertIn('remaining', msg)
            challenge.refresh_from_db()
            self.assertFalse(challenge.is_locked)

        # 5th failed attempt locks challenge
        ok, msg = challenge.verify('000000' if code != '000000' else '111111')
        self.assertFalse(ok)
        self.assertIn('locked', msg.lower())
        challenge.refresh_from_db()
        self.assertTrue(challenge.is_locked)
        self.assertFalse(challenge.is_valid)

        # Subsequent attempts remain locked
        ok, msg = challenge.verify(code)
        self.assertFalse(ok)
        self.assertIn('locked', msg.lower())

    def test_challenge_expiration(self):
        challenge, code, _, _ = LoginChallenge.create_challenge(
            user=self.user,
            purpose=ChallengePurpose.LOGIN,
            ttl_minutes=10
        )
        # Fast forward past expires_at
        challenge.expires_at = timezone.now() - timedelta(minutes=1)
        challenge.save(update_fields=['expires_at'])

        self.assertTrue(challenge.is_expired)
        ok, msg = challenge.verify(code)
        self.assertFalse(ok)
        self.assertIn('expired', msg.lower())

    def test_challenge_cannot_reuse_consumed(self):
        challenge, code, _, _ = LoginChallenge.create_challenge(
            user=self.user,
            purpose=ChallengePurpose.LOGIN
        )
        ok, _ = challenge.verify(code)
        self.assertTrue(ok)

        # Second attempt
        ok, msg = challenge.verify(code)
        self.assertFalse(ok)
        self.assertIn('already been used', msg.lower())

    def test_challenge_resend_cooldown_and_limit(self):
        challenge, code, _, _ = LoginChallenge.create_challenge(
            user=self.user,
            purpose=ChallengePurpose.LOGIN
        )
        # Immediate resend fails due to 60s cooldown
        ok, err, _ = challenge.resend()
        self.assertFalse(ok)
        self.assertIn('wait', err.lower())

        # Backdate last_sent_at by 61 seconds
        challenge.last_sent_at = timezone.now() - timedelta(seconds=61)
        challenge.save(update_fields=['last_sent_at'])

        ok, err, new_code = challenge.resend()
        self.assertTrue(ok)
        self.assertNotEqual(code, new_code)
        self.assertEqual(challenge.sent_count, 2)

        # Max 5 sends limit test
        challenge.sent_count = 5
        challenge.last_sent_at = timezone.now() - timedelta(seconds=61)
        challenge.save(update_fields=['sent_count', 'last_sent_at'])
        ok, err, _ = challenge.resend()
        self.assertFalse(ok)
        self.assertIn('maximum', err.lower())

    def test_hourly_email_cap(self):
        target = 'capped@siwoloadvocates.com'
        # Create challenges totaling 10 sent emails in last hour
        for _ in range(5):
            LoginChallenge.objects.create(
                target_email=target,
                purpose=ChallengePurpose.LOGIN,
                code_hash='fakehash',
                expires_at=timezone.now() + timedelta(minutes=10),
                sent_count=2,
                last_sent_at=timezone.now()
            )
        self.assertFalse(check_hourly_email_limit(target))

        challenge, _, sent_ok, msg = LoginChallenge.create_challenge(
            target_email=target,
            purpose=ChallengePurpose.LOGIN
        )
        self.assertIsNone(challenge)
        self.assertFalse(sent_ok)
        self.assertIn('limit reached', msg.lower())


class StageBTwoFactorAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        mail.outbox.clear()
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
        mail.outbox.clear()

    def test_login_when_2fa_enabled_does_not_issue_token_and_sends_code(self):
        login_url = reverse('auth-login')
        response = self.client.post(login_url, {
            'username': 'peter_siwolo',
            'password': 'Password123!'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('requires_2fa'))
        # Token MUST NOT be issued before code verification
        self.assertNotIn('token', response.data)
        self.assertIn('challenge_id', response.data)
        self.assertEqual(response.data['email_masked'], 'p***@siwoloadvocates.com')
        self.assertGreater(response.data['expires_in_seconds'], 0)

        # Confirm email was delivered
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Your Siwolo CMS verification code", mail.outbox[0].subject)

        # Confirm audit logs: password accepted, code sent
        actions = list(AuditLog.objects.filter(actor=self.user).values_list('action', flat=True))
        self.assertIn(AuditAction.PASSWORD_ACCEPTED, actions)
        self.assertIn(AuditAction.CODE_SENT, actions)

    def test_verify_code_success_issues_token_and_audits(self):
        # 1. Login to generate challenge
        login_url = reverse('auth-login')
        login_res = self.client.post(login_url, {
            'username': 'peter_siwolo',
            'password': 'Password123!'
        }, format='json')
        challenge_id = login_res.data['challenge_id']

        # Extract code from sent email
        sent_body = mail.outbox[0].body
        # Code is 6 digits following 'code is: '
        import re
        code_match = re.search(r'code is:\s*(\d{6})', sent_body)
        self.assertIsNotNone(code_match)
        code = code_match.group(1)

        # 2. Verify code
        verify_url = reverse('auth-verify-code')
        verify_res = self.client.post(verify_url, {
            'challenge_id': challenge_id,
            'code': code
        }, format='json')

        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.assertIn('token', verify_res.data)
        self.assertEqual(verify_res.data['user']['username'], 'peter_siwolo')

        # Check audit log
        actions = list(AuditLog.objects.filter(actor=self.user).values_list('action', flat=True))
        self.assertIn(AuditAction.CODE_VERIFIED, actions)
        self.assertIn(AuditAction.SIGN_IN_SUCCEEDED, actions)

        # Challenge should now be consumed
        challenge = LoginChallenge.objects.get(id=challenge_id)
        self.assertTrue(challenge.is_consumed)

        # Replaying code must fail
        replay_res = self.client.post(verify_url, {
            'challenge_id': challenge_id,
            'code': code
        }, format='json')
        self.assertEqual(replay_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_code_wrong_code(self):
        login_url = reverse('auth-login')
        login_res = self.client.post(login_url, {
            'username': 'peter_siwolo',
            'password': 'Password123!'
        }, format='json')
        challenge_id = login_res.data['challenge_id']

        verify_url = reverse('auth-verify-code')
        verify_res = self.client.post(verify_url, {
            'challenge_id': challenge_id,
            'code': '000000'
        }, format='json')

        self.assertEqual(verify_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid verification code', verify_res.data['error'])

        actions = list(AuditLog.objects.filter(actor=self.user).values_list('action', flat=True))
        self.assertIn(AuditAction.CODE_FAILED, actions)

    def test_verify_code_five_attempts_locks_challenge(self):
        login_url = reverse('auth-login')
        login_res = self.client.post(login_url, {
            'username': 'peter_siwolo',
            'password': 'Password123!'
        }, format='json')
        challenge_id = login_res.data['challenge_id']

        verify_url = reverse('auth-verify-code')
        for _ in range(4):
            res = self.client.post(verify_url, {'challenge_id': challenge_id, 'code': '999999'}, format='json')
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertFalse(res.data.get('is_locked'))

        # 5th attempt locks challenge
        res5 = self.client.post(verify_url, {'challenge_id': challenge_id, 'code': '999999'}, format='json')
        self.assertEqual(res5.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(res5.data.get('is_locked'))

        actions = list(AuditLog.objects.filter(actor=self.user).values_list('action', flat=True))
        self.assertIn(AuditAction.CHALLENGE_LOCKED, actions)

    def test_resend_code_endpoint(self):
        login_url = reverse('auth-login')
        login_res = self.client.post(login_url, {
            'username': 'peter_siwolo',
            'password': 'Password123!'
        }, format='json')
        challenge_id = login_res.data['challenge_id']
        self.assertEqual(len(mail.outbox), 1)

        resend_url = reverse('auth-resend-code')
        # Immediate resend fails due to cooldown
        resend_res = self.client.post(resend_url, {'challenge_id': challenge_id}, format='json')
        self.assertEqual(resend_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('wait', resend_res.data['error'].lower())

        # Backdate last_sent_at by 65 seconds
        challenge = LoginChallenge.objects.get(id=challenge_id)
        challenge.last_sent_at = timezone.now() - timedelta(seconds=65)
        challenge.save(update_fields=['last_sent_at'])

        # Resend succeeds
        resend_ok = self.client.post(resend_url, {'challenge_id': challenge_id}, format='json')
        self.assertEqual(resend_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 2)

    def test_logout_audit_logged(self):
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        logout_url = reverse('auth-logout')
        res = self.client.post(logout_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        actions = list(AuditLog.objects.filter(actor=self.user).values_list('action', flat=True))
        self.assertIn(AuditAction.SIGN_OUT, actions)

    def test_audit_log_never_records_code_or_password(self):
        # Trigger failed login and failed code attempt
        login_url = reverse('auth-login')
        self.client.post(login_url, {'username': 'peter_siwolo', 'password': 'SuperSecretPasswordXYZ'}, format='json')

        # Check all audit logs
        logs = AuditLog.objects.all()
        for log in logs:
            self.assertNotIn('SuperSecretPasswordXYZ', log.target_repr)
            self.assertNotIn('SuperSecretPasswordXYZ', str(log.details))



