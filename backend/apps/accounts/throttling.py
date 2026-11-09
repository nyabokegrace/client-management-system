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
