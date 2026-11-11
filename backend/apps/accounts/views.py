from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from config.firm_settings import get_firm_details
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import User, UserRole, LoginChallenge, ChallengePurpose
from .throttling import (
    LoginBurstRateThrottle,
    VerifyCodeRateThrottle,
    ResendCodeRateThrottle,
)
from .emails import mask_email
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
    Used to guide first-time platform users to sign up.
    """
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        has_users = User.objects.filter(is_active=True).exists()
        return Response({
            'has_users': has_users,
            'firm_name': getattr(settings, 'FIRM_NAME', 'Siwolo P.O Law Advocates'),
        }, status=status.HTTP_200_OK)


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
