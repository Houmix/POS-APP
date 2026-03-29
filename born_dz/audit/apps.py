from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'audit'
    verbose_name = 'Audit Trail'

    def ready(self):
        from . import signals  # noqa: F401 - Audit Trail signals
        from . import versioning  # noqa: F401 - Versioning auto-increment
