# sync/serializers.py
# ==========================================
# 🔄 Sérialiseurs pour la synchronisation
# ==========================================
# Convertissent les modèles Django en JSON (pour envoyer aux bornes)
# et le JSON en objets Django (pour recevoir des bornes).

from menu.models import GroupMenu, Menu, Option, Step, StepOption
from order.models import Order, OrderItem, OrderItemOption
from restaurant.models import Restaurant


# ──────────────────────────────────────────
#  MODEL → JSON  (pour envoyer aux bornes)
# ──────────────────────────────────────────

def serialize_group_menu(obj):
    return {
        'id': obj.id,
        'name': obj.name,
        'description': obj.description,
        'photo': obj.photo.url if obj.photo else None,
        'avalaible': obj.avalaible,
        'extra': obj.extra,
        'position': obj.position,
        'restaurant_id': obj.restaurant_id,
    }

def serialize_menu(obj):
    return {
        'id': obj.id,
        'name': obj.name,
        'description': obj.description,
        'price': str(obj.price),
        'solo_price': str(obj.solo_price),
        'photo': obj.photo.url if obj.photo else None,
        'group_menu_id': obj.group_menu_id,
        'avalaible': obj.avalaible,
        'extra': obj.extra,
        'position': obj.position,
        'type': obj.type,
    }

def serialize_option(obj):
    return {
        'id': obj.id,
        'name': obj.name,
        'photo': obj.photo.url if obj.photo else None,
        'type': obj.type,
        'avalaible': obj.avalaible,
        'extra_price': str(obj.extra_price),
    }

def serialize_step(obj):
    return {
        'id': obj.id,
        'name': obj.name,
        'number': obj.number,
        'menu_id': obj.menu_id,
        'max_options': obj.max_options,
        'type': obj.type,
        'avalaible': obj.avalaible,
    }

def serialize_step_option(obj):
    return {
        'id': obj.id,
        'step_id': obj.step_id,
        'option_id': obj.option_id,
        'avalaible': obj.avalaible,
        'is_default': obj.is_default,
        'extra_price': str(obj.extra_price),
    }

def serialize_order(obj):
    return {
        'id': obj.id,
        'restaurant_id': obj.restaurant_id,
        'user_id': obj.user_id,
        'status': obj.status,
        'cash': obj.cash,
        'paid': obj.paid,
        'refund': obj.refund,
        'cancelled': obj.cancelled,
        'take_away': obj.take_away,
        'created_at': obj.created_at.isoformat() if obj.created_at else None,
    }

def serialize_order_item(obj):
    return {
        'id': obj.id,
        'order_id': obj.order_id,
        'menu_id': obj.menu_id,
        'extra': obj.extra,
        'solo': obj.solo,
        'quantity': obj.quantity,
    }

def serialize_order_item_option(obj):
    return {
        'id': obj.id,
        'order_item_id': obj.order_item_id,
        'option_id': obj.option_id,
    }


# ──────────────────────────────────────────
#  FULL SNAPSHOT  (export complet d'un restaurant)
# ──────────────────────────────────────────

def full_snapshot(restaurant_id):
    """
    Exporte TOUT le catalogue d'un restaurant en un seul JSON.
    Utilisé pour la première sync d'une borne (bootstrap).
    """
    restaurant = Restaurant.objects.get(id=restaurant_id)

    # Récupérer tous les GroupMenus de ce restaurant
    group_menus = GroupMenu.objects.filter(restaurant=restaurant)
    menus = Menu.objects.filter(group_menu__restaurant=restaurant)
    menu_ids = menus.values_list('id', flat=True)
    steps = Step.objects.filter(menu_id__in=menu_ids)
    step_ids = steps.values_list('id', flat=True)
    step_options = StepOption.objects.filter(step_id__in=step_ids)
    option_ids = step_options.values_list('option_id', flat=True).distinct()
    options = Option.objects.filter(id__in=option_ids)

    return {
        'restaurant': {
            'id': restaurant.id,
            'name': restaurant.name,
        },
        'group_menus': [serialize_group_menu(g) for g in group_menus],
        'menus': [serialize_menu(m) for m in menus],
        'options': [serialize_option(o) for o in options],
        'steps': [serialize_step(s) for s in steps],
        'step_options': [serialize_step_option(so) for so in step_options],
    }


# ──────────────────────────────────────────
#  TABLE REGISTRY
# ──────────────────────────────────────────
# Mapping utilisé par les views pour résoudre table_name → (Model, serializer)

from django.apps import apps

TABLE_REGISTRY = {
    'group_menu':       ('menu.GroupMenu',       serialize_group_menu),
    'menu':             ('menu.Menu',             serialize_menu),
    'option':           ('menu.Option',           serialize_option),
    'step':             ('menu.Step',             serialize_step),
    'step_option':      ('menu.StepOption',       serialize_step_option),
    'order':            ('order.Order',           serialize_order),
    'order_item':       ('order.OrderItem',       serialize_order_item),
    'order_item_option': ('order.OrderItemOption', serialize_order_item_option),
}

def get_model_for_table(table_name):
    """Résout un nom de table vers son modèle Django."""
    entry = TABLE_REGISTRY.get(table_name)
    if not entry:
        raise ValueError(f"Table inconnue: {table_name}")
    app_model_path = entry[0]
    app_label, model_name = app_model_path.rsplit('.', 1)
    return apps.get_model(app_label, model_name)

def get_serializer_for_table(table_name):
    """Résout un nom de table vers sa fonction de sérialisation."""
    entry = TABLE_REGISTRY.get(table_name)
    if not entry:
        return None
    return entry[1]