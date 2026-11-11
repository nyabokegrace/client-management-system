import hmac
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email as django_validate_email
from config.firm_settings import get_firm_details
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import User, UserRole, LoginChallenge, ChallengePurpose, RecoveryCode
from .throttling import (
    LoginBurstRateThrottle,
    VerifyCodeRateThrottle,
    ResendCodeRateThrottle,
    ForgotPasswordRateThrottle,
    ResetPasswordRateThrottle,
)
from .emails import (
    mask_email,
    generate_six_digit_code,
    hash_code,
    send_verification_email,
    check_hourly_email_limit,
)
from .serializers import (
    UserSerializer,
    UserProfileUpdateSerializer,
    UserCreateUpdateSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    SignUpSerializer,
)
from .permissions import IsAdministrator, IsInternalStaff
from apps.audit.models import log_activity, AuditAction, AuditModule


def get_client_ip(request):
    """Helper to extract real client IP address considering proxy headers."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class HealthCheckView(APIView):
    """
    Service health check endpoint for monitoring, uptime probes, and Render.
    """
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        return Response({
            'status': 'healthy',
            'service': 'Siwolo P.O Law Advocates CMS',
            'timezone': getattr(settings, 'TIME_ZONE', 'Africa/Nairobi'),
        }, status=status.HTTP_200_OK)


class FirmSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(get_firm_details())


class SetupStatusView(APIView):
    """
    Returns platform setup status (whether an active user account exists).
    Used to guide first-time platform users to set up the administrator account.
    """
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        has_users = User.objects.exists()
        setup_code_set = bool(getattr(settings, 'SETUP_CODE', ''))
        return Response({
            'has_users': has_users,
            'needs_setup': not has_users,
            'setup_required': not has_users,
            'setup_enabled': setup_code_set,
            'firm_name': getattr(settings, 'FIRM_NAME', 'Siwolo P.O Law Advocates'),
        }, status=status.HTTP_200_OK)


class SetupView(APIView):
    """
    First-run administrator setup.
    Works ONLY while there are zero users in the database; permanently refuses once an account exists.
    Requires the SETUP_CODE environment variable's value, compared in constant time.
    If SETUP_CODE is not configured, setup is disabled entirely.

    Flow:
    1. Initial POST: enters setup_code, name, email, password.
       Sends a 6-digit setup code to the target email to prove it works and was typed correctly.
    2. Verification: enters challenge_id and code.
       Atomically creates the single administrator account and returns the 10 recovery codes shown once.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginBurstRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)

        # 1. Permanently refuse if any user already exists
        if User.objects.exists():
            return Response(
                {'error': 'Setup is permanently closed. An administrator account already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # If challenge_id and code are supplied to POST /api/v1/auth/setup/, delegate to verification
        if request.data.get('challenge_id') and (request.data.get('code') or request.data.get('verification_code')):
            return SetupVerifyView().post(request)

        # 2. Check SETUP_CODE environment variable
        server_setup_code = getattr(settings, 'SETUP_CODE', None)
        if not server_setup_code:
            return Response(
                {'error': 'First-run setup is disabled on this server. SETUP_CODE environment variable is not configured.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        setup_code = request.data.get('setup_code', '')
        if not setup_code or not hmac.compare_digest(
            str(setup_code).strip().encode('utf-8'),
            str(server_setup_code).strip().encode('utf-8')
        ):
            log_activity(
                actor=None,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_repr="Invalid setup code entered during first-run setup attempt",
                ip_address=ip_addr
            )
            return Response(
                {'error': 'Invalid setup code.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        name = (request.data.get('name') or request.data.get('full_name', '')).strip()
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        username = (request.data.get('username') or '').strip().lower()

        if not name or not email or not password:
            return Response(
                {'error': 'name, email, and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            django_validate_email(email)
        except ValidationError:
            return Response({'error': 'Please enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password using Django's validators
        try:
            validate_password(password)
        except ValidationError as err:
            return Response({'error': list(err.messages)}, status=status.HTTP_400_BAD_REQUEST)

        if not check_hourly_email_limit(email):
            return Response(
                {'error': 'Too many emails sent to this address recently. Please wait and try again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        if not username:
            username = email.split('@')[0].lower()
            if not username or username in ['root', 'administrator']:
                username = 'admin'

        code = generate_six_digit_code()
        code_h = hash_code(code)
        ttl = int(getattr(settings, 'CHALLENGE_TTL_MINUTES', 10))
        expires = timezone.now() + timedelta(minutes=ttl)

        challenge = LoginChallenge.objects.create(
            user=None,
            purpose=ChallengePurpose.SETUP,
            target_email=email,
            code_hash=code_h,
            expires_at=expires,
            metadata={
                'name': name,
                'username': username,
                'password_hash': make_password(password),
            }
        )

        sent, send_err = send_verification_email(email, code, purpose=ChallengePurpose.SETUP, ttl_minutes=ttl)
        if not sent:
            return Response({'error': send_err}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        log_activity(
            actor=None,
            actor_name=name,
            action=AuditAction.CODE_SENT,
            module=AuditModule.AUTH,
            target_id=str(challenge.id),
            target_repr=f"Setup verification code emailed to {email}",
            ip_address=ip_addr
        )

        return Response({
            'message': 'Setup code verified. A 6-digit confirmation code has been emailed to your address.',
            'challenge_id': str(challenge.id),
            'target_email': email,
            'masked_email': mask_email(email),
            'expires_in_seconds': ttl * 60,
        }, status=status.HTTP_200_OK)


class SetupVerifyView(APIView):
    """
    Verifies the email code for first-run setup.
    Guarantees atomic creation of exactly one administrator account and
    generates 10 emergency recovery codes to be shown once.
    """
    permission_classes = [AllowAny]
    throttle_classes = [VerifyCodeRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)

        if User.objects.exists():
            return Response(
                {'error': 'Setup is permanently closed. An administrator account already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        challenge_id = request.data.get('challenge_id')
        code = (request.data.get('code') or request.data.get('verification_code', '')).strip()

        if not challenge_id or not code:
            return Response(
                {'error': 'challenge_id and code are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            challenge = LoginChallenge.objects.get(id=challenge_id, purpose=ChallengePurpose.SETUP)
        except (LoginChallenge.DoesNotExist, ValueError):
            return Response({'error': 'Invalid setup challenge.'}, status=status.HTTP_400_BAD_REQUEST)

        if challenge.is_consumed or challenge.is_expired or challenge.is_locked:
            err = (
                "This verification challenge has expired." if challenge.is_expired else
                "This verification challenge has been locked due to too many failed attempts." if challenge.is_locked else
                "This verification challenge has already been used."
            )
            return Response({'error': err, 'is_locked': challenge.is_locked, 'is_expired': challenge.is_expired}, status=status.HTTP_400_BAD_REQUEST)

        ok, err_msg = challenge.verify(code)
        if not ok:
            log_activity(
                actor=None,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_id=str(challenge.id),
                target_repr=f"Failed setup verification attempt ({challenge.attempts}/5)",
                ip_address=ip_addr
            )
            return Response({'error': err_msg or 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Atomic transaction preventing simultaneous creation
        with transaction.atomic():
            if User.objects.select_for_update().exists():
                return Response(
                    {'error': 'Setup is permanently closed. An administrator account already exists.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            metadata = challenge.metadata or {}
            full_name = metadata.get('name', 'Peter Siwolo').strip()
            username = metadata.get('username') or 'admin'
            password_hash = metadata.get('password_hash')

            name_parts = full_name.split(maxsplit=1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''

            user = User(
                username=username,
                email=challenge.target_email,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.ADMIN,
                is_staff=True,
                is_superuser=True,
                is_active=True,
            )
            if password_hash:
                user.password = password_hash
            else:
                user.set_unusable_password()
            user.save()

            recovery_codes = RecoveryCode.generate_codes_for_user(user, count=10)

            challenge.user = user
            challenge.consumed_at = timezone.now()
            challenge.save(update_fields=['user', 'consumed_at'])

            token, _ = Token.objects.get_or_create(user=user)

            log_activity(
                actor=user,
                action=AuditAction.CODE_VERIFIED,
                module=AuditModule.AUTH,
                target_id=str(user.id),
                target_repr=f"Email verified for first-run administrator account {user.username}",
                ip_address=ip_addr
            )
            log_activity(
                actor=user,
                action=AuditAction.CREATE,
                module=AuditModule.AUTH,
                target_id=str(user.id),
                target_repr=f"Administrator account created: {user.username} ({user.full_name})",
                ip_address=ip_addr
            )

        return Response({
            'message': 'Administrator account created successfully. Store your recovery codes in a secure location.',
            'recovery_codes': recovery_codes,
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


class SignUpView(APIView):
    """
    Sign up endpoint for user registration.
    Allows first-time or new user to set name, username, and password.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginBurstRateThrottle]

    def post(self, request):
        serializer = SignUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Extract client IP for audit trail
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
        if ip_addr and ',' in ip_addr:
            ip_addr = ip_addr.split(',')[0].strip()

        log_activity(
            actor=user,
            action=AuditAction.CREATE,
            module=AuditModule.AUTH,
            target_id=str(user.id),
            target_repr=f"Signed up user: {user.username} ({user.full_name})",
            details={'username': user.username, 'name': user.full_name},
            ip_address=ip_addr,
        )

        return Response({
            'message': 'Account created successfully. Please sign in with your username and password.',
            'username': user.username,
            'full_name': user.full_name,
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginBurstRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            username = request.data.get('username', '')
            log_activity(
                actor=None,
                actor_name=str(username)[:100],
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_repr=f"Failed login attempt for username: {username}",
                ip_address=ip_addr
            )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data['user']
        log_activity(
            actor=user,
            action=AuditAction.PASSWORD_ACCEPTED,
            module=AuditModule.AUTH,
            target_id=str(user.id),
            target_repr=f"Password accepted for: {user.username}",
            ip_address=ip_addr
        )

        require_2fa = getattr(settings, 'REQUIRE_2FA', True)
        if require_2fa:
            # Two-factor authentication flow: generate and email one-time code
            challenge, code, sent_ok, send_err = LoginChallenge.create_challenge(
                user=user,
                target_email=user.email,
                purpose=ChallengePurpose.LOGIN,
                ttl_minutes=getattr(settings, 'CHALLENGE_TTL_MINUTES', 10)
            )
            if not sent_ok:
                log_activity(
                    actor=user,
                    action=AuditAction.CODE_FAILED,
                    module=AuditModule.AUTH,
                    target_id=str(challenge.id) if challenge else '',
                    target_repr=f"Failed to deliver 2FA code to {user.email}: {send_err}",
                    ip_address=ip_addr
                )
                return Response(
                    {'error': send_err or 'We could not send the email, try again'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            log_activity(
                actor=user,
                action=AuditAction.CODE_SENT,
                module=AuditModule.AUTH,
                target_id=str(challenge.id),
                target_repr=f"Verification code sent to {mask_email(user.email)}",
                ip_address=ip_addr
            )

            return Response({
                'requires_2fa': True,
                'challenge_id': str(challenge.id),
                'email_masked': mask_email(user.email),
                'expires_in_seconds': challenge.seconds_until_expiry,
                'seconds_until_resend': challenge.seconds_until_resend,
                'message': f"Verification code sent to {mask_email(user.email)}.",
            }, status=status.HTTP_200_OK)

        # Fallback when 2FA is explicitly disabled
        token, created = Token.objects.get_or_create(user=user)
        if not created and (timezone.now() - token.created > timedelta(hours=12)):
            token.delete()
            token = Token.objects.create(user=user)

        log_activity(
            actor=user,
            action=AuditAction.SIGN_IN_SUCCEEDED,
            module=AuditModule.AUTH,
            target_id=str(user.id),
            target_repr=f"Sign-in succeeded for: {user.username}",
            ip_address=ip_addr
        )

        user_data = UserSerializer(user).data
        user_data['firm'] = get_firm_details()

        return Response({
            'token': token.key,
            'user': user_data,
            'message': 'Authentication successful.'
        }, status=status.HTTP_200_OK)


class VerifyCodeView(APIView):
    """
    Verifies the 6-digit one-time code for two-factor login.
    On success, consumes the challenge and returns the expiring auth token.
    """
    permission_classes = [AllowAny]
    throttle_classes = [VerifyCodeRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)
        challenge_id = request.data.get('challenge_id')
        code = request.data.get('code', '').strip()

        if not challenge_id or not code:
            return Response(
                {'error': 'challenge_id and code are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            challenge = LoginChallenge.objects.get(id=challenge_id, purpose=ChallengePurpose.LOGIN)
        except (LoginChallenge.DoesNotExist, ValueError):
            log_activity(
                actor=None,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_repr="Invalid challenge ID during code verification",
                ip_address=ip_addr
            )
            return Response(
                {'error': 'Invalid or expired verification challenge.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ok, error_msg = challenge.verify(code)
        if not ok:
            if challenge.is_locked:
                log_activity(
                    actor=challenge.user,
                    action=AuditAction.CHALLENGE_LOCKED,
                    module=AuditModule.AUTH,
                    target_id=str(challenge.id),
                    target_repr=f"Verification challenge locked after 5 failed attempts for {challenge.target_email}",
                    ip_address=ip_addr
                )
            else:
                log_activity(
                    actor=challenge.user,
                    action=AuditAction.CODE_FAILED,
                    module=AuditModule.AUTH,
                    target_id=str(challenge.id),
                    target_repr=f"Failed code verification attempt ({challenge.attempts}/5) for {challenge.target_email}",
                    ip_address=ip_addr
                )
            return Response({
                'error': error_msg,
                'is_locked': challenge.is_locked,
                'is_expired': challenge.is_expired,
            }, status=status.HTTP_400_BAD_REQUEST)

        # Code verification succeeded!
        log_activity(
            actor=challenge.user,
            action=AuditAction.CODE_VERIFIED,
            module=AuditModule.AUTH,
            target_id=str(challenge.id),
            target_repr=f"Verification code verified for {challenge.target_email}",
            ip_address=ip_addr
        )

        # Issue 12-hour expiring token
        token, created = Token.objects.get_or_create(user=challenge.user)
        if not created and (timezone.now() - token.created > timedelta(hours=12)):
            token.delete()
            token = Token.objects.create(user=challenge.user)

        log_activity(
            actor=challenge.user,
            action=AuditAction.SIGN_IN_SUCCEEDED,
            module=AuditModule.AUTH,
            target_id=str(challenge.user.id),
            target_repr=f"Sign-in succeeded for {challenge.user.username}",
            ip_address=ip_addr
        )

        user_data = UserSerializer(challenge.user).data
        user_data['firm'] = get_firm_details()

        return Response({
            'token': token.key,
            'user': user_data,
            'message': 'Authentication successful.'
        }, status=status.HTTP_200_OK)


class ResendCodeView(APIView):
    """
    Resends a new verification code for an active login challenge.
    Enforces a 60-second cooldown, max 5 sends, and hourly email rate limits.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ResendCodeRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)
        challenge_id = request.data.get('challenge_id')

        if not challenge_id:
            return Response({'error': 'challenge_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            challenge = LoginChallenge.objects.get(id=challenge_id, purpose=ChallengePurpose.LOGIN)
        except (LoginChallenge.DoesNotExist, ValueError):
            return Response(
                {'error': 'Invalid or expired verification challenge.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ok, err_msg, new_code = challenge.resend()
        if not ok:
            log_activity(
                actor=challenge.user,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_id=str(challenge.id),
                target_repr=f"Resend rejected for {challenge.target_email}: {err_msg}",
                ip_address=ip_addr
            )
            return Response({'error': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        log_activity(
            actor=challenge.user,
            action=AuditAction.CODE_SENT,
            module=AuditModule.AUTH,
            target_id=str(challenge.id),
            target_repr=f"Verification code resent to {mask_email(challenge.target_email)} (send {challenge.sent_count}/5)",
            ip_address=ip_addr
        )

        return Response({
            'message': f"A new verification code has been sent to {mask_email(challenge.target_email)}.",
            'expires_in_seconds': challenge.seconds_until_expiry,
            'seconds_until_resend': 60,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ip_addr = get_client_ip(request)
        if hasattr(request.user, 'auth_token'):
            request.user.auth_token.delete()
        log_activity(
            actor=request.user,
            action=AuditAction.SIGN_OUT,
            module=AuditModule.AUTH,
            target_id=str(request.user.id),
            target_repr=f"User signed out: {request.user.username}",
            ip_address=ip_addr
        )
        return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = UserSerializer(request.user).data
        data['firm'] = get_firm_details()
        return Response(data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        data = UserSerializer(request.user).data
        data['firm'] = get_firm_details()
        return Response(data, status=status.HTTP_200_OK)

    def put(self, request):
        return self.patch(request)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'message': 'Password updated successfully.'}, status=status.HTTP_200_OK)


class RequestEmailChangeView(APIView):
    """
    Initiates changing the administrator email address in My Profile.
    Requires current password confirmation.
    Sends a verification code to the new email address before any change takes effect.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [LoginBurstRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)
        current_password = request.data.get('current_password') or request.data.get('password', '')
        new_email = (request.data.get('new_email') or request.data.get('email', '')).strip().lower()

        if not current_password or not new_email:
            return Response(
                {'error': 'current_password and new_email are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.user.check_password(current_password):
            log_activity(
                actor=request.user,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_repr="Password confirmation failed during email change request",
                ip_address=ip_addr
            )
            return Response({'error': 'Incorrect current password.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            django_validate_email(new_email)
        except ValidationError:
            return Response({'error': 'Please enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_email == request.user.email.strip().lower():
            return Response({'error': 'The new email address must be different from your current email.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists():
            return Response({'error': 'This email address is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

        if not check_hourly_email_limit(new_email):
            return Response({'error': 'Too many emails sent to this address recently. Please wait and try again.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        code = generate_six_digit_code()
        ttl = int(getattr(settings, 'CHALLENGE_TTL_MINUTES', 10))
        expires = timezone.now() + timedelta(minutes=ttl)

        challenge = LoginChallenge.objects.create(
            user=request.user,
            purpose=ChallengePurpose.EMAIL_CHANGE,
            target_email=new_email,
            code_hash=hash_code(code),
            expires_at=expires,
            metadata={'new_email': new_email}
        )

        sent, send_err = send_verification_email(new_email, code, purpose=ChallengePurpose.EMAIL_CHANGE, ttl_minutes=ttl)
        if not sent:
            return Response({'error': send_err}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        log_activity(
            actor=request.user,
            action=AuditAction.CODE_SENT,
            module=AuditModule.AUTH,
            target_id=str(challenge.id),
            target_repr=f"Email change verification code sent to {new_email}",
            ip_address=ip_addr
        )

        return Response({
            'message': f'Verification code sent to {new_email}.',
            'challenge_id': str(challenge.id),
            'new_email': new_email,
            'masked_email': mask_email(new_email),
            'expires_in_seconds': ttl * 60,
        }, status=status.HTTP_200_OK)


class VerifyEmailChangeView(APIView):
    """
    Verifies the email change code and updates user.email.
    Until verified, user.email remains unchanged.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [VerifyCodeRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)
        challenge_id = request.data.get('challenge_id')
        code = (request.data.get('code') or request.data.get('verification_code', '')).strip()

        if not challenge_id or not code:
            return Response(
                {'error': 'challenge_id and code are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            challenge = LoginChallenge.objects.get(
                id=challenge_id,
                user=request.user,
                purpose=ChallengePurpose.EMAIL_CHANGE
            )
        except (LoginChallenge.DoesNotExist, ValueError):
            return Response({'error': 'Invalid email change challenge.'}, status=status.HTTP_400_BAD_REQUEST)

        if challenge.is_consumed or challenge.is_expired or challenge.is_locked:
            err = (
                "This verification challenge has expired." if challenge.is_expired else
                "This verification challenge has been locked due to too many failed attempts." if challenge.is_locked else
                "This verification challenge has already been used."
            )
            return Response({'error': err, 'is_locked': challenge.is_locked, 'is_expired': challenge.is_expired}, status=status.HTTP_400_BAD_REQUEST)

        ok, err_msg = challenge.verify(code)
        if not ok:
            log_activity(
                actor=request.user,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_id=str(challenge.id),
                target_repr=f"Failed email change verification attempt ({challenge.attempts}/5)",
                ip_address=ip_addr
            )
            return Response({'error': err_msg or 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        new_email = challenge.target_email
        if User.objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists():
            return Response({'error': 'This email address is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

        old_email = request.user.email
        request.user.email = new_email
        request.user.save(update_fields=['email', 'updated_at'])

        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=['consumed_at'])

        log_activity(
            actor=request.user,
            action=AuditAction.CODE_VERIFIED,
            module=AuditModule.AUTH,
            target_id=str(request.user.id),
            target_repr=f"Email address successfully changed from {old_email} to {new_email}",
            ip_address=ip_addr
        )

        return Response({
            'message': 'Email address successfully updated.',
            'email': request.user.email,
            'user': UserSerializer(request.user).data
        }, status=status.HTTP_200_OK)


class EmailChangeView(APIView):
    """
    Unified endpoint for email change:
    - Without code: requests verification code for new email.
    - With code: verifies code and updates email address.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.data.get('code') or request.data.get('verification_code'):
            return VerifyEmailChangeView().post(request)
        return RequestEmailChangeView().post(request)


class VerifyRecoveryCodeView(APIView):
    """
    Verifies a single-use emergency recovery code in place of an email 2FA code.
    Consumes the recovery code, consumes the login challenge, writes to the audit log,
    and returns the 12-hour auth token.
    Warns the user when 3 or fewer recovery codes remain.
    """
    permission_classes = [AllowAny]
    throttle_classes = [VerifyCodeRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)
        challenge_id = request.data.get('challenge_id')
        code = (request.data.get('recovery_code') or request.data.get('code', '')).strip()

        if not challenge_id or not code:
            return Response(
                {'error': 'challenge_id and recovery_code are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            challenge = LoginChallenge.objects.get(id=challenge_id, purpose=ChallengePurpose.LOGIN)
        except (LoginChallenge.DoesNotExist, ValueError):
            log_activity(
                actor=None,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_repr="Invalid challenge ID during recovery code verification",
                ip_address=ip_addr
            )
            return Response(
                {'error': 'Invalid or expired verification challenge.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if challenge.is_consumed or challenge.is_expired or challenge.is_locked:
            error_msg = "This verification challenge has expired." if challenge.is_expired else (
                "This verification challenge has been locked due to too many failed attempts." if challenge.is_locked else
                "This verification challenge has already been used."
            )
            return Response({'error': error_msg, 'is_locked': challenge.is_locked, 'is_expired': challenge.is_expired}, status=status.HTTP_400_BAD_REQUEST)

        if not challenge.user:
            return Response({'error': 'No user associated with this challenge.'}, status=status.HTTP_400_BAD_REQUEST)

        ok, remaining = RecoveryCode.verify_and_consume(challenge.user, code)
        if not ok:
            challenge.attempts += 1
            challenge.save(update_fields=['attempts'])
            if challenge.is_locked:
                log_activity(
                    actor=challenge.user,
                    action=AuditAction.CHALLENGE_LOCKED,
                    module=AuditModule.AUTH,
                    target_id=str(challenge.id),
                    target_repr=f"Verification challenge locked after 5 failed attempts for {challenge.target_email}",
                    ip_address=ip_addr
                )
                return Response(
                    {'error': 'This verification challenge has been locked due to too many failed attempts.', 'is_locked': True},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                log_activity(
                    actor=challenge.user,
                    action=AuditAction.CODE_FAILED,
                    module=AuditModule.AUTH,
                    target_id=str(challenge.id),
                    target_repr=f"Failed recovery code attempt ({challenge.attempts}/5) for {challenge.target_email}",
                    ip_address=ip_addr
                )
                return Response({'error': 'Invalid recovery code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mark challenge consumed
        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=['consumed_at'])

        # Log recovery code used
        log_activity(
            actor=challenge.user,
            action=AuditAction.RECOVERY_CODE_USED,
            module=AuditModule.AUTH,
            target_id=str(challenge.user.id),
            target_repr=f"Emergency recovery code used for sign-in ({remaining} remaining)",
            ip_address=ip_addr
        )

        # Issue 12-hour expiring token
        token, created = Token.objects.get_or_create(user=challenge.user)
        if not created and (timezone.now() - token.created > timedelta(hours=12)):
            token.delete()
            token = Token.objects.create(user=challenge.user)

        log_activity(
            actor=challenge.user,
            action=AuditAction.SIGN_IN_SUCCEEDED,
            module=AuditModule.AUTH,
            target_id=str(challenge.user.id),
            target_repr=f"Sign-in succeeded with recovery code for {challenge.user.username}",
            ip_address=ip_addr
        )

        user_data = UserSerializer(challenge.user).data
        user_data['firm'] = get_firm_details()

        warning = None
        if remaining <= 3:
            warning = f"Warning: You have only {remaining} recovery code{'s' if remaining != 1 else ''} remaining. Please generate a new set in My Profile."

        return Response({
            'token': token.key,
            'user': user_data,
            'remaining_codes': remaining,
            'warning': warning,
            'message': 'Authentication successful via recovery code.'
        }, status=status.HTTP_200_OK)


class GenerateRecoveryCodesView(APIView):
    """
    Generates 10 new emergency single-use recovery codes for the authenticated user.
    Requires providing their current password. Invalidates any previous recovery codes.
    Codes are displayed exactly once in the response.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ip_addr = get_client_ip(request)
        password = request.data.get('password', '')

        if not password:
            return Response(
                {'error': 'Current password is required to generate new recovery codes.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.user.check_password(password):
            log_activity(
                actor=request.user,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_id=str(request.user.id),
                target_repr=f"Incorrect password attempt while generating recovery codes for {request.user.username}",
                ip_address=ip_addr
            )
            return Response(
                {'error': 'Incorrect password. Please enter your current password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        codes = RecoveryCode.generate_codes_for_user(request.user, count=10)

        log_activity(
            actor=request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.AUTH,
            target_id=str(request.user.id),
            target_repr=f"Generated new set of 10 recovery codes for {request.user.username}",
            ip_address=ip_addr
        )

        return Response({
            'recovery_codes': codes,
            'count': len(codes),
            'message': '10 new recovery codes generated. Store them in a safe place. They will not be shown again.'
        }, status=status.HTTP_200_OK)


class RecoveryCodeCountView(APIView):
    """
    Returns the count of remaining active recovery codes for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        remaining = RecoveryCode.objects.filter(user=request.user, consumed_at__isnull=True).count()
        return Response({'remaining': remaining}, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    """
    Initiates a password reset challenge.
    Takes a username or email identifier.
    Always returns the exact same generic success response regardless of account existence.
    If the account exists, emails a 15-minute reset challenge code.
    Strictly throttled and audit-logged.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ForgotPasswordRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)
        identifier = (request.data.get('identifier') or request.data.get('username') or request.data.get('email', '')).strip()

        if identifier:
            user = User.objects.filter(
                Q(username__iexact=identifier) | Q(email__iexact=identifier),
                is_active=True
            ).first()

            if user and user.email:
                challenge, code, sent_ok, send_err = LoginChallenge.create_challenge(
                    user=user,
                    target_email=user.email,
                    purpose=ChallengePurpose.RESET,
                    ttl_minutes=15
                )
                if sent_ok:
                    log_activity(
                        actor=user,
                        action=AuditAction.CODE_SENT,
                        module=AuditModule.AUTH,
                        target_id=str(challenge.id),
                        target_repr=f"Password reset verification code sent to {mask_email(user.email)}",
                        ip_address=ip_addr
                    )
                else:
                    log_activity(
                        actor=user,
                        action=AuditAction.CODE_FAILED,
                        module=AuditModule.AUTH,
                        target_id=str(challenge.id) if challenge else '',
                        target_repr=f"Failed to deliver password reset code to {user.email}: {send_err}",
                        ip_address=ip_addr
                    )
            else:
                log_activity(
                    actor=None,
                    actor_name=identifier[:100],
                    action=AuditAction.CODE_FAILED,
                    module=AuditModule.AUTH,
                    target_repr="Password reset requested for nonexistent or inactive identifier",
                    ip_address=ip_addr
                )

        return Response({
            'message': 'If an account matches that username or email, a reset code has been sent.'
        }, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """
    Resets user password with a verified reset challenge code.
    Validates password complexity using Django validators.
    Ends every existing session by deleting auth tokens.
    Consumes the challenge.
    Requires user to sign in normally afterwards (enforcing 2FA).
    Strictly throttled and audit-logged.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ResetPasswordRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)
        identifier = (request.data.get('identifier') or request.data.get('username') or request.data.get('email', '')).strip()
        code = request.data.get('code', '').strip()
        new_password = request.data.get('new_password', '')

        if not identifier or not code or not new_password:
            return Response(
                {'error': 'identifier, code, and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier),
            is_active=True
        ).first()

        if not user:
            log_activity(
                actor=None,
                actor_name=identifier[:100],
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_repr="Password reset failed: user not found",
                ip_address=ip_addr
            )
            return Response({'error': 'Invalid or expired reset code.'}, status=status.HTTP_400_BAD_REQUEST)

        challenge = LoginChallenge.objects.filter(
            user=user,
            purpose=ChallengePurpose.RESET,
            consumed_at__isnull=True
        ).order_by('-created_at').first()

        if not challenge or challenge.is_expired or challenge.is_locked:
            log_activity(
                actor=user,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_id=str(challenge.id) if challenge else '',
                target_repr="Password reset failed: challenge not found or expired/locked",
                ip_address=ip_addr
            )
            return Response({'error': 'Invalid or expired reset code.'}, status=status.HTTP_400_BAD_REQUEST)

        ok, err_msg = challenge.verify(code)
        if not ok:
            if challenge.is_locked:
                log_activity(
                    actor=user,
                    action=AuditAction.CHALLENGE_LOCKED,
                    module=AuditModule.AUTH,
                    target_id=str(challenge.id),
                    target_repr=f"Reset challenge locked after 5 failed attempts for {user.username}",
                    ip_address=ip_addr
                )
            else:
                log_activity(
                    actor=user,
                    action=AuditAction.CODE_FAILED,
                    module=AuditModule.AUTH,
                    target_id=str(challenge.id),
                    target_repr=f"Failed reset code verification attempt ({challenge.attempts}/5) for {user.username}",
                    ip_address=ip_addr
                )
            return Response({'error': err_msg or 'Invalid reset code.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password with Django validators
        try:
            validate_password(new_password, user=user)
        except ValidationError as err:
            return Response({'error': list(err.messages)}, status=status.HTTP_400_BAD_REQUEST)

        # Set new password
        user.set_password(new_password)
        user.save()

        # Invalidate all existing auth tokens (ends every existing session)
        Token.objects.filter(user=user).delete()

        # Mark challenge as consumed
        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=['consumed_at'])

        log_activity(
            actor=user,
            action=AuditAction.PASSWORD_RESET,
            module=AuditModule.AUTH,
            target_id=str(user.id),
            target_repr=f"Password successfully reset for {user.username}",
            ip_address=ip_addr
        )

        return Response({
            'message': 'Password has been reset successfully. Please sign in with your new password.'
        }, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD for users.
    Only administrators can create/modify users.
    All internal staff can read the list (e.g. to assign advocates/staff to matters or tasks).
    """
    queryset = User.objects.all()
    filterset_fields = ['role', 'is_active']
    search_fields = ['username', 'first_name', 'last_name', 'email']
    ordering_fields = ['first_name', 'last_name', 'username', 'created_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsInternalStaff()]
        return [IsAdministrator()]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UserCreateUpdateSerializer
        return UserSerializer
