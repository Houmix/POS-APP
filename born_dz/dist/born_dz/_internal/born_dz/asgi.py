"""
ASGI config for born_dz project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""


# asgi.py
import os
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'born_dz.settings')
django_asgi_app = get_asgi_application()
import borne_sync.routing # Importez le routing de votre app

application = ProtocolTypeRouter({
    "http": get_asgi_application(), # Gestionnaire pour les requêtes HTTP classiques
    "websocket": AuthMiddlewareStack( # Gestionnaire pour les WebSockets
        URLRouter(
            borne_sync.routing.websocket_urlpatterns
        )
    ),
})