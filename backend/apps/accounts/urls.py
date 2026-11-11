from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    LogoutView,
    VerifyCodeView,
    ResendCodeView,
    SignUpView,
    SetupStatusView,
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
    path('auth/signup/', SignUpView.as_view(), name='auth-signup'),
    path('auth/setup-status/', SetupStatusView.as_view(), name='auth-setup-status'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('firm-settings/', FirmSettingsView.as_view(), name='firm-settings'),
    path('users/', include(router.urls)),
]
