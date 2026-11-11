from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from config.firm_settings import get_firm_details
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import User, UserRole
from .throttling import LoginBurstRateThrottle
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
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        if not created and (timezone.now() - token.created > timedelta(hours=12)):
            token.delete()
            token = Token.objects.create(user=user)

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
        if hasattr(request.user, 'auth_token'):
            request.user.auth_token.delete()
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
