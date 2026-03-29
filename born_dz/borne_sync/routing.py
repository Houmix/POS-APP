# borne_sync/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/borne/sync/$',    consumers.BorneSyncConsumer.as_asgi()),
    re_path(r'ws/borne/control/$', consumers.BorneControlConsumer.as_asgi()),
    re_path(r'ws/kds/$',           consumers.KDSConsumer.as_asgi()),
    re_path(r'ws/display/$',       consumers.DisplayConsumer.as_asgi()),
]