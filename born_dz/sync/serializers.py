# sync/serializers.py
# ==========================================
# 🔄 Sérialiseurs pour la synchronisation
# ==========================================
# Convertissent les modèles Django en JSON (pour envoyer aux bornes)
# et le JSON en objets Django (pour recevoir des bornes).

from menu.models import GroupMenu, Menu, Option, Step, MenuStep, StepOption
from order.models import Order, OrderItem, OrderItemOption
from restaurant.models import Restaurant, KioskConfig


# ──────────────────────────────────────────
#  HELPER : URL de photo (local ou distant)
# ──────────────────────────────────────────

def _photo_url(photo_field, base_url=''):
    """
    Renvoie l'URL de la photo, en gérant deux cas :
    - Serveur distant (base_url fourni) → URL absolue avec le domaine du serveur
    - Django local (après sync) → la valeur stockée est déjà une URL absolue distante,
      on la renvoie telle quelle pour que la borne puisse charger l'image depuis le cloud.
    """
    if not photo_field:
        return None
    name = str(photo_field)
    if not name:
        return None
    # Déjà une URL absolue (stockée depuis un sync distant)
    if name.startswith('http://') or name.startswith('https://'):
        return name
    # Fichier local → construire l'URL absolue
    if base_url:
        try:
            relative = photo_field.url  # ex: /media/restaurant/menu/burger.jpg
            return f"{base_url.rstrip('/')}{relative}"
        except Exception:
            return f"{base_url.rstrip('/')}/media/{name.lstrip('/')}"
    try:
        return photo_field.url
    except Exception:
        return None


# ──────────────────────────────────────────
#  MODEL → JSON  (pour envoyer aux bornes)
# ──────────────────────────────────────────

def serialize_group_menu(obj, base_url=''):
    return {
        'id': obj.id,
        'name': obj.name,
        'description': obj.description,
        'photo': _photo_url(obj.photo, base_url),
        'avalaible': obj.avalaible,
        'extra': obj.extra,
        'position': obj.position,
        'restaurant_id': obj.restaurant_id,
    }

def serialize_menu(obj, base_url=''):
    return {
        'id': obj.id,
        'name': obj.name,
        'description': obj.description,
        'price': str(obj.price),
        'solo_price': str(obj.solo_price),
        'photo': _photo_url(obj.photo, base_url),
        'group_menu_id': obj.group_menu_id,
        'avalaible': obj.avalaible,
        'extra': obj.extra,
        'position': obj.position,
        'type': obj.type,
    }

def serialize_option(obj, base_url=''):
    return {
        'id': obj.id,
        'name': obj.name,
        'photo': _photo_url(obj.photo, base_url),
        'type': obj.type,
        'avalaible': obj.avalaible,
        'extra_price': str(obj.extra_price),
    }

def serialize_step(obj):
    return {
        'id': obj.id,
        'restaurant_id': obj.restaurant_id,
        'name': obj.name,
        'max_options': obj.max_options,
        'avalaible': obj.avalaible,
    }

def serialize_menu_step(obj):
    return {
        'id': obj.id,
        'menu_id': obj.menu_id,
        'step_id': obj.step_id,
        'number': obj.number,
        'show_for_solo': obj.show_for_solo,
        'show_for_full': obj.show_for_full,
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

def serialize_kiosk_config(obj, base_url=''):
    """
    Sérialise la config kiosk pour sync vers les bornes locales.
    base_url = URL absolue du serveur distant (ex: https://myserver.com)
    pour que les URLs d'images soient accessibles depuis l'Expo.
    """
    def abs_url(path):
        if not path:
            return None
        url = path.url if hasattr(path, 'url') else str(path)
        if url.startswith('http'):
            return url
        return f"{base_url.rstrip('/')}{url}" if base_url else url

    return {
        'restaurant_id':              obj.restaurant_id,
        'primary_color':              obj.primary_color,
        'secondary_color':            obj.secondary_color,
        'background_color':           obj.background_color,
        'card_bg_color':              obj.card_bg_color,
        'text_color':                 obj.text_color,
        'sidebar_color':              obj.sidebar_color,
        'category_bg_color':          obj.category_bg_color,
        'selected_category_bg_color': obj.selected_category_bg_color,
        'category_text_color':        obj.category_text_color,
        'logo_remote_url':            abs_url(obj.logo) or abs_url(obj.restaurant.logo),
        'screensaver_video_remote_url': abs_url(obj.screensaver_video),
        'card_style':                 obj.card_style,
        'composition_mode':           obj.composition_mode,
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

def full_snapshot(restaurant_id, base_url=''):
    """
    Exporte TOUT le catalogue d'un restaurant en un seul JSON.
    Utilisé pour la première sync d'une borne (bootstrap).
    base_url : URL absolue du serveur distant pour les URLs média.
    """
    restaurant = Restaurant.objects.get(id=restaurant_id)

    group_menus = GroupMenu.objects.filter(restaurant=restaurant)
    menus = Menu.objects.filter(group_menu__restaurant=restaurant)
    menu_ids = menus.values_list('id', flat=True)
    steps = Step.objects.filter(restaurant=restaurant)
    step_ids = steps.values_list('id', flat=True)
    menu_steps = MenuStep.objects.filter(menu_id__in=menu_ids)
    step_options = StepOption.objects.filter(step_id__in=step_ids)
    option_ids = step_options.values_list('option_id', flat=True).distinct()
    options = Option.objects.filter(id__in=option_ids)

    # KioskConfig (thème/branding)
    try:
        kiosk_config = KioskConfig.objects.get(restaurant=restaurant)
        kiosk_config_data = serialize_kiosk_config(kiosk_config, base_url)
    except KioskConfig.DoesNotExist:
        kiosk_config_data = None

    return {
        'restaurant': {
            'id': restaurant.id,
            'name': restaurant.name,
            'address': restaurant.address,
            'phone': restaurant.phone,
            'immat': restaurant.immat,
            'logo_url': _photo_url(restaurant.logo, base_url),
        },
        'kiosk_config': kiosk_config_data,
        'group_menus': [serialize_group_menu(g, base_url) for g in group_menus],
        'menus': [serialize_menu(m, base_url) for m in menus],
        'options': [serialize_option(o, base_url) for o in options],
        'steps': [serialize_step(s) for s in steps],
        'menu_steps': [serialize_menu_step(ms) for ms in menu_steps],
        'step_options': [serialize_step_option(so) for so in step_options],
    }


# ──────────────────────────────────────────
#  TABLE REGISTRY
# ──────────────────────────────────────────
# Mapping utilisé par les views pour résoudre table_name → (Model, serializer)

from django.apps import apps

TABLE_REGISTRY = {
    'group_menu':       ('menu.GroupMenu',           serialize_group_menu),
    'menu':             ('menu.Menu',                serialize_menu),
    'option':           ('menu.Option',              serialize_option),
    'step':             ('menu.Step',                serialize_step),
    'menu_step':        ('menu.MenuStep',            serialize_menu_step),
    'step_option':      ('menu.StepOption',          serialize_step_option),
    'order':            ('order.Order',              serialize_order),
    'order_item':       ('order.OrderItem',          serialize_order_item),
    'order_item_option': ('order.OrderItemOption',   serialize_order_item_option),
    'kiosk_config':     ('restaurant.KioskConfig',   serialize_kiosk_config),
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