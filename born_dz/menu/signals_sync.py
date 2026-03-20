# menu/signals_sync.py
"""
Signaux menu → création de SyncLog + notification WebSocket bornes.

Quand un menu/catégorie/option/step change sur le serveur distant,
on crée un SyncLog pour que le SyncManager Electron puisse le puller
et l'appliquer sur le Django local des caisses.

Le guard sync_apply_guard empêche la boucle infinie :
    remote change → signal → SyncLog OK
    apply_change() locale → signal ignoré (guard actif)
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Menu, GroupMenu, Option, Step, MenuStep, StepOption


# ─────────────────────────────────────────────────────
#  Helper : créer un SyncLog sans importer circulairement
# ─────────────────────────────────────────────────────

def _get_base_url():
    """
    Retourne l'URL de base du serveur en ligne.
    On la lit depuis SERVER_BASE_URL dans les settings (à définir dans .env),
    sinon on cherche railway.app dans ALLOWED_HOSTS comme fallback.
    """
    try:
        from django.conf import settings
        # Priorité 1 : variable explicite dans les settings
        base = getattr(settings, 'SERVER_BASE_URL', '')
        if base:
            return base.rstrip('/')
        # Priorité 2 : chercher railway.app ou le premier host de production connu
        priority_keywords = ('railway.app', 'vercel.app', 'heroku')
        for host in getattr(settings, 'ALLOWED_HOSTS', []):
            if host and any(kw in host for kw in priority_keywords):
                return f"https://{host}"
        # Fallback : premier host non-local
        for host in getattr(settings, 'ALLOWED_HOSTS', []):
            if host and host not in ('127.0.0.1', 'localhost', '*') and not host.startswith('192.168.'):
                return f"https://{host}"
    except Exception:
        pass
    return ''


def _log_change(table_name, action, record_id, data, restaurant_id):
    """Crée une entrée SyncLog (restaurant_id peut être None pour Option)."""
    if restaurant_id is None:
        return  # On ne peut pas logger sans restaurant
    try:
        from sync.models import SyncLog
        SyncLog.objects.create(
            restaurant_id=restaurant_id,
            table_name=table_name,
            action=action,
            record_id=record_id,
            data=data,
            source='server',
            terminal_uuid='',
        )
    except Exception as e:
        print(f"[SYNC] Erreur création SyncLog ({table_name} #{record_id}): {e}")


def _notify_bornes():
    """Envoie un WebSocket force-reload à toutes les bornes connectées."""
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
                        'type': 'menu_update',
                        'status': 'full_sync_required',
                        'timestamp': datetime.now(dt_timezone.utc).isoformat(),
                    }
                }
            )
    except Exception as e:
        print(f"[SYNC] Erreur WebSocket notify: {e}")


# ─────────────────────────────────────────────────────
#  GroupMenu
# ─────────────────────────────────────────────────────

@receiver(post_save, sender=GroupMenu)
def group_menu_saved(sender, instance, created, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    from sync.serializers import serialize_group_menu
    action = 'create' if created else 'update'
    print(f"[SYNC] GroupMenu '{instance.name}' {action} → SyncLog + WebSocket")
    _log_change('group_menu', action, instance.id, serialize_group_menu(instance, _get_base_url()), instance.restaurant_id)
    _notify_bornes()


@receiver(post_delete, sender=GroupMenu)
def group_menu_deleted(sender, instance, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    print(f"[SYNC] GroupMenu '{instance.name}' supprimé → SyncLog + WebSocket")
    _log_change('group_menu', 'delete', instance.id, {'id': instance.id}, instance.restaurant_id)
    _notify_bornes()


# ─────────────────────────────────────────────────────
#  Menu
# ─────────────────────────────────────────────────────

def _menu_restaurant_id(instance):
    try:
        return instance.group_menu.restaurant_id
    except Exception:
        return None


@receiver(post_save, sender=Menu)
def menu_saved(sender, instance, created, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    from sync.serializers import serialize_menu
    action = 'create' if created else 'update'
    restaurant_id = _menu_restaurant_id(instance)
    print(f"[SYNC] Menu '{instance.name}' {action} → SyncLog + WebSocket")
    _log_change('menu', action, instance.id, serialize_menu(instance, _get_base_url()), restaurant_id)
    _notify_bornes()


@receiver(post_delete, sender=Menu)
def menu_deleted(sender, instance, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    restaurant_id = _menu_restaurant_id(instance)
    print(f"[SYNC] Menu '{instance.name}' supprimé → SyncLog + WebSocket")
    _log_change('menu', 'delete', instance.id, {'id': instance.id}, restaurant_id)
    _notify_bornes()


# ─────────────────────────────────────────────────────
#  Option
# ─────────────────────────────────────────────────────

def _option_restaurant_id(instance):
    """Option n'a pas de FK restaurant direct, on passe par StepOption → Step."""
    try:
        step_option = instance.option.first()  # related_name='option' sur StepOption
        if step_option:
            return step_option.step.restaurant_id
    except Exception:
        pass
    return None


@receiver(post_save, sender=Option)
def option_saved(sender, instance, created, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    from sync.serializers import serialize_option
    action = 'create' if created else 'update'
    restaurant_id = _option_restaurant_id(instance)
    print(f"[SYNC] Option '{instance.name}' {action} → SyncLog")
    _log_change('option', action, instance.id, serialize_option(instance, _get_base_url()), restaurant_id)
    _notify_bornes()


@receiver(post_delete, sender=Option)
def option_deleted(sender, instance, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    restaurant_id = _option_restaurant_id(instance)
    print(f"[SYNC] Option '{instance.name}' supprimée → SyncLog")
    _log_change('option', 'delete', instance.id, {'id': instance.id}, restaurant_id)
    _notify_bornes()


# ─────────────────────────────────────────────────────
#  Step
# ─────────────────────────────────────────────────────

@receiver(post_save, sender=Step)
def step_saved(sender, instance, created, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    from sync.serializers import serialize_step
    action = 'create' if created else 'update'
    print(f"[SYNC] Step '{instance.name}' {action} → SyncLog")
    _log_change('step', action, instance.id, serialize_step(instance), instance.restaurant_id)
    _notify_bornes()


@receiver(post_delete, sender=Step)
def step_deleted(sender, instance, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    print(f"[SYNC] Step '{instance.name}' supprimé → SyncLog")
    _log_change('step', 'delete', instance.id, {'id': instance.id}, instance.restaurant_id)
    _notify_bornes()


# ─────────────────────────────────────────────────────
#  MenuStep
# ─────────────────────────────────────────────────────

def _menu_step_restaurant_id(instance):
    try:
        return instance.step.restaurant_id
    except Exception:
        return None


@receiver(post_save, sender=MenuStep)
def menu_step_saved(sender, instance, created, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    from sync.serializers import serialize_menu_step
    action = 'create' if created else 'update'
    restaurant_id = _menu_step_restaurant_id(instance)
    print(f"[SYNC] MenuStep #{instance.id} {action} → SyncLog")
    _log_change('menu_step', action, instance.id, serialize_menu_step(instance), restaurant_id)
    _notify_bornes()


@receiver(post_delete, sender=MenuStep)
def menu_step_deleted(sender, instance, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    restaurant_id = _menu_step_restaurant_id(instance)
    print(f"[SYNC] MenuStep #{instance.id} supprimé → SyncLog")
    _log_change('menu_step', 'delete', instance.id, {'id': instance.id}, restaurant_id)
    _notify_bornes()


# ─────────────────────────────────────────────────────
#  StepOption
# ─────────────────────────────────────────────────────

def _step_option_restaurant_id(instance):
    try:
        return instance.step.restaurant_id
    except Exception:
        return None


@receiver(post_save, sender=StepOption)
def step_option_saved(sender, instance, created, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    from sync.serializers import serialize_step_option
    action = 'create' if created else 'update'
    restaurant_id = _step_option_restaurant_id(instance)
    print(f"[SYNC] StepOption #{instance.id} {action} → SyncLog")
    _log_change('step_option', action, instance.id, serialize_step_option(instance), restaurant_id)
    _notify_bornes()


@receiver(post_delete, sender=StepOption)
def step_option_deleted(sender, instance, **kwargs):
    from sync.signal_guard import is_applying_sync
    if is_applying_sync():
        return

    restaurant_id = _step_option_restaurant_id(instance)
    print(f"[SYNC] StepOption #{instance.id} supprimé → SyncLog")
    _log_change('step_option', 'delete', instance.id, {'id': instance.id}, restaurant_id)
    _notify_bornes()
