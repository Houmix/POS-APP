# sync/apps.py

from django.apps import AppConfig


class SyncConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sync'
    verbose_name = 'Synchronisation'

    def ready(self):
        from .signals import register_sync_signals
        register_sync_signals()

        # Sync automatique cloud → local (uniquement sur serveur POS local / SQLite)
        import os
        if not os.environ.get('DATABASE_URL') and os.environ.get('AUTO_SYNC_ENABLED', '').lower() in ('1', 'true'):
            from .auto_sync import start_auto_sync
            start_auto_sync()