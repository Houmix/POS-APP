# sync/apps.py

from django.apps import AppConfig


class SyncConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sync'
    verbose_name = 'Synchronisation'

    def ready(self):
        from .signals import register_sync_signals
        register_sync_signals()