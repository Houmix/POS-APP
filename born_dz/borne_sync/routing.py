# borne_sync/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Assurez-vous que ce chemin est bien celui que le client appelle (borne/sync/)
    re_path(r'ws/borne/sync/$', consumers.BorneSyncConsumer.as_asgi()), 
]