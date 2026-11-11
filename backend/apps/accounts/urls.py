from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    LogoutView,
    VerifyCodeView,
    ResendCodeView,
    VerifyRecoveryCodeView,
    GenerateRecoveryCodesView,
    RecoveryCodeCountView,
    ForgotPasswordView,
    ResetPasswordView,
    SignUpView,
    SetupStatusView,
    SetupView,
    SetupVerifyView,
    RequestEmailChangeView,
    VerifyEmailChangeView,
    EmailChangeView,
    CurrentUserView,
    ChangePasswordView,
    FirmSettingsView,
    UserViewSet,
)

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/verify-code/', VerifyCodeView.as_view(), name='auth-verify-code'),
    path('auth/resend-code/', ResendCodeView.as_view(), name='auth-resend-code'),
    path('auth/verify-recovery-code/', VerifyRecoveryCodeView.as_view(), name='auth-verify-recovery-code'),
    path('auth/recovery-codes/generate/', GenerateRecoveryCodesView.as_view(), name='auth-generate-recovery-codes'),
    path('auth/recovery-codes/count/', RecoveryCodeCountView.as_view(), name='auth-recovery-codes-count'),
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='auth-reset-password'),
    path('auth/signup/', SignUpView.as_view(), name='auth-signup'),
    path('auth/setup-status/', SetupStatusView.as_view(), name='auth-setup-status'),
    path('auth/setup/', SetupView.as_view(), name='auth-setup'),
    path('auth/setup/verify/', SetupVerifyView.as_view(), name='auth-setup-verify'),
    path('auth/email-change/request/', RequestEmailChangeView.as_view(), name='auth-email-change-request'),
    path('auth/email-change/verify/', VerifyEmailChangeView.as_view(), name='auth-email-change-verify'),
    path('auth/email-change/', EmailChangeView.as_view(), name='auth-email-change'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('firm-settings/', FirmSettingsView.as_view(), name='firm-settings'),
    path('users/', include(router.urls)),
]
