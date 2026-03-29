# audit/middleware.py
# ==========================================
# Middleware pour capturer le contexte utilisateur
# ==========================================
# Injecte l'utilisateur et l'IP dans le thread-local
# pour que les signaux d'audit puissent y acceder.

from .signals import set_audit_context, clear_audit_context


class AuditMiddleware:
    """
    Middleware qui capture l'utilisateur authentifie et l'adresse IP
    pour chaque requete HTTP. Ces informations sont ensuite disponibles
    dans les signaux Django pour l'audit trail.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extraire l'IP (support proxy)
        ip = self._get_client_ip(request)

        # Injecter le contexte dans le thread-local
        user = request.user if hasattr(request, 'user') and request.user.is_authenticated else None
        set_audit_context(
            user=user,
            ip_address=ip,
            extra={
                'method': request.method,
                'path': request.path,
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200],
            }
        )

        response = self.get_response(request)

        # Nettoyer le contexte
        clear_audit_context()

        return response

    @staticmethod
    def _get_client_ip(request):
        """Extrait l'IP reelle du client, meme derriere un proxy."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
