"""
ASGI config for born_dz project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""


# asgi.py
import os
import sys
import django

# Force UTF-8 sur Windows (évite les erreurs charmap avec les caractères Unicode dans les logs)
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
from django.core.asgi import get_asgi_application

# On définit les settings avant tout
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'born_dz.settings')
# On initialise Django
django.setup()

# Maintenant on peut importer le reste
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
import borne_sync.routing 

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            borne_sync.routing.websocket_urlpatterns
        )
    ),
})