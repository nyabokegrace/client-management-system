from rest_framework.throttling import SimpleRateThrottle


class LoginBurstRateThrottle(SimpleRateThrottle):
    """
    Limits burst login attempts from a given IP address.
    Allows 5 attempts per minute before returning 429 Too Many Requests.
    """
    scope = 'login'

    def get_cache_key(self, request, view):
        # Throttle by remote IP address
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class VerifyCodeRateThrottle(SimpleRateThrottle):
    """
    Limits 2FA and verification code verification attempts.
    """
    scope = 'verify_code'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class ResendCodeRateThrottle(SimpleRateThrottle):
    """
    Limits code resend requests per IP address.
    """
    scope = 'resend_code'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class ForgotPasswordRateThrottle(SimpleRateThrottle):
    """
    Limits forgot-password requests from a given IP address.
    """
    scope = 'forgot_password'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class ResetPasswordRateThrottle(SimpleRateThrottle):
    """
    Limits password reset attempts from a given IP address.
    """
    scope = 'reset_password'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


