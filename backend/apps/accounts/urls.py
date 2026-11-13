from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    LogoutView,
    GenerateRecoveryCodesView,
    RecoveryCodeCountView,
    SetupStatusView,
    SetupView,
    SetupConfirmView,
    CurrentUserView,
    ChangePasswordView,
    FirmSettingsView,
    UserViewSet,
)

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/setup-status/', SetupStatusView.as_view(), name='auth-setup-status'),
    path('auth/setup/', SetupView.as_view(), name='auth-setup'),
    path('auth/setup/confirm/', SetupConfirmView.as_view(), name='auth-setup-confirm'),
    path('auth/setup/verify/', SetupConfirmView.as_view(), name='auth-setup-verify'),
    path('auth/recovery-codes/generate/', GenerateRecoveryCodesView.as_view(), name='auth-generate-recovery-codes'),
    path('auth/recovery-codes/count/', RecoveryCodeCountView.as_view(), name='auth-recovery-codes-count'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('firm-settings/', FirmSettingsView.as_view(), name='firm-settings'),
    path('users/', include(router.urls)),
]
