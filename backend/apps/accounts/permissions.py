from rest_framework import permissions
from .models import UserRole


class IsAdministrator(permissions.BasePermission):
    """
    Grants access only to users with the Administrator role or superusers.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_active and
            request.user.is_administrator
        )


class IsAdvocateOrAdmin(permissions.BasePermission):
    """
    Grants access to Advocates and Administrators.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_active and
            (request.user.is_administrator or request.user.role == UserRole.ADVOCATE)
        )


class IsInternalStaff(permissions.BasePermission):
    """
    Requires the user to be active internal personnel.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_active
        )
