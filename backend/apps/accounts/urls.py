from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    LogoutView,
    CurrentUserView,
    ChangePasswordView,
    FirmSettingsView,
    UserViewSet,
)

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('firm-settings/', FirmSettingsView.as_view(), name='firm-settings'),
    path('users/', include(router.urls)),
]
