from datetime import timedelta
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    """
    Token authentication with 12-hour expiration window.
    """
    EXPIRATION_HOURS = 12

    def authenticate_credentials(self, key):
        model = self.get_model()
        try:
            token = model.objects.select_related('user').get(key=key)
        except model.DoesNotExist:
            raise AuthenticationFailed('Invalid token.')

        if not token.user.is_active:
            raise AuthenticationFailed('User inactive or deleted.')

        if timezone.now() - token.created > timedelta(hours=self.EXPIRATION_HOURS):
            raise AuthenticationFailed('Token has expired. Please log in again.')

        return (token.user, token)
