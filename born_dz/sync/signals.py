# sync/signals.py
# ==========================================
# 🔄 Auto-logging des changements Django
# ==========================================
# Quand un admin modifie un menu, une option, un prix...
# → ça crée automatiquement une entrée SyncLog
# → les bornes la récupèrent au prochain pull
#
# Aucun besoin de toucher au code admin existant !

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from menu.models import GroupMenu, Menu, Option, Step, StepOption
from order.models import Order, OrderItem, OrderItemOption

from .models import SyncLog
from .serializers import (
    serialize_group_menu, serialize_menu, serialize_option,
    serialize_step, serialize_step_option, serialize_order,
    serialize_order_item, serialize_order_item_option,
)

# ──────────────────────────────────────────
#  Configuration : Model → (table_name, serializer, get_restaurant_id)
# ──────────────────────────────────────────

def _get_restaurant_from_group_menu(obj):
    return obj.restaurant_id

def _get_restaurant_from_menu(obj):
    if obj.group_menu:
        return obj.group_menu.restaurant_id
    return None

def _get_restaurant_from_option(obj):
    # Option n'a pas de FK directe → via StepOption → Step → restaurant
    step_option = obj.option.first()  # related_name="option"
    if step_option and step_option.step:
        return step_option.step.restaurant_id
    return None

def _get_restaurant_from_step(obj):
    # Step a maintenant une FK directe vers restaurant
    return obj.restaurant_id

def _get_restaurant_from_step_option(obj):
    # StepOption → Step → restaurant
    if obj.step:
        return obj.step.restaurant_id
    return None

def _get_restaurant_from_order(obj):
    return obj.restaurant_id

def _get_restaurant_from_order_item(obj):
    return obj.order.restaurant_id

def _get_restaurant_from_order_item_option(obj):
    return obj.order_item.order.restaurant_id


SIGNAL_CONFIG = {
    GroupMenu:        ('group_menu',        serialize_group_menu,        _get_restaurant_from_group_menu),
    Menu:             ('menu',              serialize_menu,              _get_restaurant_from_menu),
    Option:           ('option',            serialize_option,            _get_restaurant_from_option),
    Step:             ('step',              serialize_step,              _get_restaurant_from_step),
    StepOption:       ('step_option',       serialize_step_option,       _get_restaurant_from_step_option),
    Order:            ('order',             serialize_order,             _get_restaurant_from_order),
    OrderItem:        ('order_item',        serialize_order_item,        _get_restaurant_from_order_item),
    OrderItemOption:  ('order_item_option', serialize_order_item_option, _get_restaurant_from_order_item_option),
}


# ──────────────────────────────────────────
#  Flag pour éviter les boucles
# ──────────────────────────────────────────
# Quand apply_change() sauvegarde un objet, ça déclenche post_save.
# Ce flag empêche de re-logger un changement qui vient de la sync.

import threading
_sync_applying = threading.local()

def set_sync_applying(value=True):
    """Appelé par apply_change pour désactiver les signaux temporairement."""
    _sync_applying.active = value

def is_sync_applying():
    return getattr(_sync_applying, 'active', False)


# ──────────────────────────────────────────
#  SIGNAL HANDLERS
# ──────────────────────────────────────────

def _handle_save(sender, instance, created, **kwargs):
    """Appelé après chaque save() sur un modèle surveillé."""
    if is_sync_applying():
        return  # Changement vient de la sync, ne pas re-logger

    config = SIGNAL_CONFIG.get(sender)
    if not config:
        return

    table_name, serializer, get_restaurant_id = config

    try:
        restaurant_id = get_restaurant_id(instance)
        if not restaurant_id:
            return  # Pas de restaurant associé, on skip

        SyncLog.objects.create(
            restaurant_id=restaurant_id,
            table_name=table_name,
            action='create' if created else 'update',
            record_id=instance.id,
            data=serializer(instance),
            source='server',
        )
    except Exception as e:
        # Ne jamais bloquer une sauvegarde à cause de la sync
        import logging
        logging.getLogger('sync').error(f"Erreur signal sync ({table_name}): {e}")


def _handle_delete(sender, instance, **kwargs):
    """Appelé après chaque delete() sur un modèle surveillé."""
    if is_sync_applying():
        return

    config = SIGNAL_CONFIG.get(sender)
    if not config:
        return

    table_name, serializer, get_restaurant_id = config

    try:
        restaurant_id = get_restaurant_id(instance)
        if not restaurant_id:
            return

        SyncLog.objects.create(
            restaurant_id=restaurant_id,
            table_name=table_name,
            action='delete',
            record_id=instance.id,
            data={'id': instance.id},
            source='server',
        )
    except Exception as e:
        import logging
        logging.getLogger('sync').error(f"Erreur signal sync delete ({table_name}): {e}")


# ──────────────────────────────────────────
#  ENREGISTREMENT DES SIGNAUX
# ──────────────────────────────────────────

def register_sync_signals():
    """Connecte les signaux Django pour tous les modèles à synchroniser."""
    for model_class in SIGNAL_CONFIG:
        post_save.connect(_handle_save, sender=model_class, dispatch_uid=f'sync_save_{model_class.__name__}')
        post_delete.connect(_handle_delete, sender=model_class, dispatch_uid=f'sync_delete_{model_class.__name__}')