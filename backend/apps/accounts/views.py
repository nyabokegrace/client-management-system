from django.conf import settings
from config.firm_settings import get_firm_details
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import User, UserRole
from .serializers import (
    UserSerializer,
    UserProfileUpdateSerializer,
    UserCreateUpdateSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
)
from .permissions import IsAdministrator, IsInternalStaff


class FirmSettingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(get_firm_details())


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)

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
