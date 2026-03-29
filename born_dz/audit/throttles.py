# audit/throttles.py
# ==========================================
# Throttle classes personnalisees (Rate Limiting)
# ==========================================
# Limitent le nombre de requetes par endpoint pour
# proteger contre les abus et les attaques.

from rest_framework.throttling import SimpleRateThrottle


class SyncThrottle(SimpleRateThrottle):
    """
    Limite les requetes de synchronisation.
    20 requetes par minute par terminal/IP.
    Empeche un terminal defaillant de surcharger le serveur.
    """
    scope = 'sync'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }


class LoginThrottle(SimpleRateThrottle):
    """
    Limite les tentatives de connexion.
    5 tentatives par minute par IP.
    Protection anti brute-force.
    """
    scope = 'login'

    def get_cache_key(self, request, view):
        # Toujours limiter par IP pour les tentatives de login
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class OrdersThrottle(SimpleRateThrottle):
    """
    Limite les requetes de commande.
    60 requetes par minute par utilisateur.
    Permet un flux normal de bornes actives.
    """
    scope = 'orders'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident,
        }
