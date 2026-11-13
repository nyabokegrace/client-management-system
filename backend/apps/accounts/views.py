import hmac
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email as django_validate_email
from config.firm_settings import get_firm_details
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_otp.plugins.otp_totp.models import TOTPDevice

from .models import User, UserRole, RecoveryCode
from .throttling import (
    LoginBurstRateThrottle,
    VerifyCodeRateThrottle,
    ForgotPasswordRateThrottle,
)
from .serializers import (
    UserSerializer,
    UserProfileUpdateSerializer,
    UserCreateUpdateSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
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
        return Response(get_firm_details(), status=status.HTTP_200_OK)


class SetupStatusView(APIView):
    """
    Public discovery endpoint that indicates whether the system has been initialized.
    Returns:
      - is_setup_required: True if zero users exist in the database.
      - initialized: True if at least one user exists and has confirmed authenticator.
      - setup_required: Backward compatibility alias for is_setup_required.
      - needs_setup: Backward compatibility alias for is_setup_required.
      - has_users: True if at least one user exists.
    """
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        user_exists = User.objects.exists()
        has_confirmed_user = TOTPDevice.objects.filter(confirmed=True).exists() if user_exists else False
        return Response({
            'is_setup_required': not user_exists,
            'setup_required': not user_exists,
            'needs_setup': not user_exists,
            'initialized': user_exists and has_confirmed_user,
            'firm_name': getattr(settings, 'FIRM_NAME', 'Siwolo P.O Law Advocates'),
            'advocate_name': getattr(settings, 'ADVOCATE_NAME', 'Peter O. Siwolo'),
            'advocate_title': getattr(settings, 'ADVOCATE_TITLE', 'Principal Advocate and Founder'),
            'has_users': user_exists,
            'has_confirmed_device': has_confirmed_user,
        }, status=status.HTTP_200_OK)


class SetupView(APIView):
    """
    First-run administrator setup endpoint protected by SETUP_CODE.
    Permanently closed once any user exists.
    After the account is created, creates an unconfirmed TOTPDevice and returns its otpauth URL.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginBurstRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)

        # Allow delegating to SetupConfirmView if confirmation code is supplied
        if request.data.get('code') or request.data.get('totp_code') or request.data.get('verification_code'):
            return SetupConfirmView().post(request)

        # 1. Permanently refuse if any user already exists
        if User.objects.exists():
            return Response(
                {'error': 'Setup is permanently closed. An administrator account already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

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
                {'error': 'Invalid setup authorization code.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Extract and validate user data
        name = (request.data.get('name') or request.data.get('full_name') or '').strip()
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password', '')
        username = (request.data.get('username') or '').strip().lower()

        if not name:
            name = getattr(settings, 'ADVOCATE_NAME', 'Peter O. Siwolo')
        if not email:
            email = getattr(settings, 'FIRM_EMAIL', 'info@siwoloadvocates.com')
        if not password:
            return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            django_validate_email(email)
        except ValidationError:
            return Response({'error': 'Please enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(password)
        except ValidationError as err:
            return Response({'error': list(err.messages)}, status=status.HTTP_400_BAD_REQUEST)

        if not username:
            username = 'admin'

        # 4. Atomically create administrator and unconfirmed TOTPDevice
        with transaction.atomic():
            if User.objects.select_for_update().exists():
                return Response(
                    {'error': 'Setup is permanently closed. An administrator account already exists.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            name_parts = name.split(maxsplit=1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''

            user = User(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.ADMIN,
                is_staff=True,
                is_superuser=True,
                is_active=True,
            )
            user.set_password(password)
            user.save()

            TOTPDevice.objects.filter(user=user).delete()
            device = TOTPDevice.objects.create(
                user=user,
                name='default',
                confirmed=False
            )

            log_activity(
                actor=user,
                action=AuditAction.CREATE,
                module=AuditModule.AUTH,
                target_id=str(user.id),
                target_repr=f"Administrator account initialized for {user.username}",
                ip_address=ip_addr
            )

        return Response({
            'message': 'Administrator account created. Please configure your authenticator app and confirm with the 6-digit code.',
            'user_id': user.id,
            'username': user.username,
            'otpauth_url': device.config_url,
        }, status=status.HTTP_201_CREATED)


class SetupConfirmView(APIView):
    """
    Verifies the six-digit authenticator code during first-run setup.
    Marks the TOTPDevice confirmed, generates 8 emergency recovery codes,
    and issues the initial 12-hour authentication token.
    """
    permission_classes = [AllowAny]
    throttle_classes = [VerifyCodeRateThrottle]

    def post(self, request):
        ip_addr = get_client_ip(request)

        user_id = request.data.get('user_id')
        username = request.data.get('username')
        code = str(request.data.get('code') or request.data.get('totp_code') or request.data.get('verification_code') or '').strip()

        if not code:
            return Response({'error': 'Verification code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Locate target user
        user = None
        if user_id:
            user = User.objects.filter(id=user_id).first()
        elif username:
            user = User.objects.filter(username=username).first()
        elif User.objects.count() == 1:
            user = User.objects.first()

        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Refuse if user already has a confirmed TOTP device
        if TOTPDevice.objects.filter(user=user, confirmed=True).exists():
            return Response(
                {'error': 'Setup confirmation has already been completed. Please log in.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        device = TOTPDevice.objects.filter(user=user, confirmed=False).first()
        if not device:
            return Response(
                {'error': 'No pending authenticator setup found for this user.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not device.verify_token(code):
            log_activity(
                actor=user,
                action=AuditAction.CODE_FAILED,
                module=AuditModule.AUTH,
                target_id=str(user.id),
                target_repr=f"Failed TOTP setup confirmation code for {user.username}",
                ip_address=ip_addr
            )
            return Response(
                {'error': 'Invalid verification code. Please check your authenticator app and try again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Device verified: mark confirmed
        device.confirmed = True
        device.save(update_fields=['confirmed'])

        # Generate 8 recovery codes
        recovery_codes = RecoveryCode.generate_codes_for_user(user, count=8)

        # Issue 12-hour token
        token, created = Token.objects.get_or_create(user=user)
        if not created and (timezone.now() - token.created > timedelta(hours=12)):
            token.delete()
            token = Token.objects.create(user=user)

        log_activity(
            actor=user,
            action=AuditAction.CODE_VERIFIED,
            module=AuditModule.AUTH,
            target_id=str(user.id),
            target_repr=f"TOTP authenticator setup verified and confirmed for {user.username}",
            ip_address=ip_addr
        )

        log_activity(
            actor=user,
            action=AuditAction.SIGN_IN_SUCCEEDED,
            module=AuditModule.AUTH,
            target_id=str(user.id),
            target_repr=f"Sign-in succeeded upon setup confirmation for {user.username}",
            ip_address=ip_addr
        )

        user_data = UserSerializer(user).data
        user_data['firm'] = get_firm_details()

        return Response({
            'message': 'Setup complete. Authenticator confirmed and emergency recovery codes generated.',
            'token': token.key,
            'user': user_data,
            'recovery_codes': recovery_codes,
        }, status=status.HTTP_200_OK)


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

        # Issue 12-hour expiring token
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


class GenerateRecoveryCodesView(APIView):
    """
    Generates 8 new emergency single-use recovery codes for the authenticated user.
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

        codes = RecoveryCode.generate_codes_for_user(request.user, count=8)

        log_activity(
            actor=request.user,
            action=AuditAction.UPDATE,
            module=AuditModule.AUTH,
            target_id=str(request.user.id),
            target_repr=f"Generated new set of 8 recovery codes for {request.user.username}",
            ip_address=ip_addr
        )

        return Response({
            'recovery_codes': codes,
            'count': len(codes),
            'message': '8 new recovery codes generated. Store them in a safe place. They will not be shown again.'
        }, status=status.HTTP_200_OK)


class RecoveryCodeCountView(APIView):
    """
    Returns the count of remaining active recovery codes for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        remaining = RecoveryCode.objects.filter(user=request.user, consumed_at__isnull=True).count()
        return Response({'remaining': remaining}, status=status.HTTP_200_OK)


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
