"""
ASGI config for born_dz project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""


# asgi.py
import os
import django
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