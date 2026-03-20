from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import KioskConfig


@receiver(post_save, sender=KioskConfig)
def kiosk_config_saved(sender, instance, **kwargs):
    """
    Quand KioskConfig est modifié (via admin Django ou API),
    notifier toutes les bornes connectées via WebSocket.
    Crée aussi un SyncLog pour que les Django locaux puissent récupérer le changement.
    """
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    # Notifier via WebSocket
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from borne_sync.consumers import SYNC_GROUP_NAME
        from datetime import datetime, timezone as dt_timezone

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                SYNC_GROUP_NAME,
                {
                    'type': 'sync.message',
                    'data': {
                        'type': 'theme_updated',
                        'status': 'theme_updated',
                        'timestamp': datetime.now(dt_timezone.utc).isoformat(),
                    }
                }
            )
    except Exception as e:
        print(f"[SYNC] KioskConfig WebSocket notify error: {e}")

    # Créer un SyncLog pour la propagation vers les Django locaux
    try:
        from sync.models import SyncLog
        from sync.serializers import serialize_kiosk_config
        SyncLog.objects.create(
            restaurant_id=instance.restaurant_id,
            table_name='kiosk_config',
            action='update',
            record_id=instance.id,
            data=serialize_kiosk_config(instance),
            source='server',
            terminal_uuid='',
        )
    except Exception as e:
        print(f"[SYNC] KioskConfig SyncLog error: {e}")
