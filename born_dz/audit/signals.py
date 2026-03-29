# audit/signals.py
# ==========================================
# Signaux Django pour l'audit trail automatique
# ==========================================
# Intercepte les save() et delete() sur les modeles cles
# et enregistre les changements dans AuditLog.

import threading
import logging
from django.db.models.signals import post_save, pre_save, post_delete
from django.dispatch import receiver

from .models import AuditLog

logger = logging.getLogger('audit')

# Thread-local pour stocker le contexte de la requete (user, IP)
_audit_context = threading.local()


def set_audit_context(user=None, ip_address=None, extra=None):
    """Appele par le middleware pour injecter le contexte utilisateur."""
    _audit_context.user = user
    _audit_context.ip_address = ip_address
    _audit_context.extra = extra or {}


def get_audit_context():
    return {
        'user': getattr(_audit_context, 'user', None),
        'ip_address': getattr(_audit_context, 'ip_address', None),
        'extra': getattr(_audit_context, 'extra', {}),
    }


def clear_audit_context():
    _audit_context.user = None
    _audit_context.ip_address = None
    _audit_context.extra = {}


# ─── Flag pour eviter les boucles (meme pattern que sync) ───
_audit_disabled = threading.local()

def disable_audit():
    _audit_disabled.active = True

def enable_audit():
    _audit_disabled.active = False

def is_audit_disabled():
    return getattr(_audit_disabled, 'active', False)


# ─── Configuration des modeles a auditer ───

AUDIT_CONFIG = {}  # Rempli dans register_audit_signals()


def _get_model_display_name(instance):
    """Retourne un nom lisible pour l'objet."""
    if hasattr(instance, 'name'):
        return str(instance.name)
    return str(instance)


def _get_restaurant_id(instance):
    """Essaye d'extraire le restaurant_id de l'objet."""
    if hasattr(instance, 'restaurant_id'):
        return instance.restaurant_id
    if hasattr(instance, 'group_menu') and instance.group_menu:
        return instance.group_menu.restaurant_id
    if hasattr(instance, 'order') and instance.order:
        return instance.order.restaurant_id
    if hasattr(instance, 'step') and instance.step:
        return instance.step.restaurant_id
    return None


def _get_user_info(user):
    """Extrait les infos utilisateur pour l'audit."""
    if user and user.is_authenticated:
        role = ''
        if hasattr(user, 'role') and user.role:
            role = str(user.role)
        return {
            'user': user,
            'user_phone': getattr(user, 'phone', '') or str(user),
            'user_role': role,
        }
    return {'user': None, 'user_phone': '', 'user_role': ''}


# ─── Stockage pre-save pour detecter les changements ───
_pre_save_state = threading.local()


def _capture_pre_save(sender, instance, **kwargs):
    """Capture l'etat avant modification pour calculer le diff."""
    if is_audit_disabled():
        return
    if sender not in AUDIT_CONFIG:
        return
    if not instance.pk:
        return  # Nouvel objet, pas de pre-save

    try:
        old_instance = sender.objects.get(pk=instance.pk)
        if not hasattr(_pre_save_state, 'data'):
            _pre_save_state.data = {}
        key = f"{sender.__name__}_{instance.pk}"
        _pre_save_state.data[key] = {
            field.name: getattr(old_instance, field.name)
            for field in sender._meta.fields
            if field.name not in ('id', 'created_at', 'updated_at')
        }
    except sender.DoesNotExist:
        pass
    except Exception as e:
        logger.debug(f"Audit pre_save error: {e}")


def _handle_post_save(sender, instance, created, **kwargs):
    """Enregistre la creation ou modification dans l'audit trail."""
    if is_audit_disabled():
        return
    if sender not in AUDIT_CONFIG:
        return

    table_name = AUDIT_CONFIG[sender]
    ctx = get_audit_context()
    user_info = _get_user_info(ctx.get('user'))

    changes = {}
    description = ''

    if created:
        description = f"Creation de {table_name} : {_get_model_display_name(instance)}"
    else:
        # Calculer le diff
        key = f"{sender.__name__}_{instance.pk}"
        old_state = getattr(_pre_save_state, 'data', {}).get(key, {})

        for field in sender._meta.fields:
            if field.name in ('id', 'created_at', 'updated_at'):
                continue
            old_val = old_state.get(field.name)
            new_val = getattr(instance, field.name)

            # Convertir pour comparaison
            if hasattr(old_val, 'name'):  # FileField
                old_val = str(old_val) if old_val else ''
                new_val = str(new_val) if new_val else ''

            if str(old_val) != str(new_val):
                changes[field.name] = {
                    'old': str(old_val) if old_val is not None else '',
                    'new': str(new_val) if new_val is not None else '',
                }

        if changes:
            changed_fields = ', '.join(changes.keys())
            description = f"Modification de {table_name} '{_get_model_display_name(instance)}' : {changed_fields}"
        else:
            return  # Pas de changement reel, pas d'audit

        # Nettoyer le cache pre-save
        if hasattr(_pre_save_state, 'data') and key in _pre_save_state.data:
            del _pre_save_state.data[key]

    try:
        severity = 'info'
        if table_name == 'order' and not created:
            # Changement de statut de commande = warning si annulation
            if changes.get('status', {}).get('new') in ('cancelled', 'refund'):
                severity = 'warning'
            if changes.get('cancelled', {}).get('new') == 'True':
                severity = 'warning'

        AuditLog.objects.create(
            action='create' if created else 'update',
            severity=severity,
            table_name=table_name,
            record_id=instance.pk,
            record_name=_get_model_display_name(instance),
            description=description,
            changes=changes,
            restaurant_id=_get_restaurant_id(instance),
            ip_address=ctx.get('ip_address'),
            extra_data=ctx.get('extra', {}),
            **user_info,
        )
    except Exception as e:
        logger.error(f"Erreur audit post_save ({table_name}): {e}")


def _handle_post_delete(sender, instance, **kwargs):
    """Enregistre la suppression dans l'audit trail."""
    if is_audit_disabled():
        return
    if sender not in AUDIT_CONFIG:
        return

    table_name = AUDIT_CONFIG[sender]
    ctx = get_audit_context()
    user_info = _get_user_info(ctx.get('user'))

    try:
        AuditLog.objects.create(
            action='delete',
            severity='warning',
            table_name=table_name,
            record_id=instance.pk,
            record_name=_get_model_display_name(instance),
            description=f"Suppression de {table_name} : {_get_model_display_name(instance)}",
            changes={},
            restaurant_id=_get_restaurant_id(instance),
            ip_address=ctx.get('ip_address'),
            extra_data=ctx.get('extra', {}),
            **user_info,
        )
    except Exception as e:
        logger.error(f"Erreur audit post_delete ({table_name}): {e}")


def register_audit_signals():
    """Connecte les signaux sur tous les modeles a auditer."""
    from menu.models import GroupMenu, Menu, Option, Step, StepOption, MenuStep
    from order.models import Order, OrderItem
    from restaurant.models import Restaurant

    global AUDIT_CONFIG
    AUDIT_CONFIG = {
        GroupMenu: 'group_menu',
        Menu: 'menu',
        Option: 'option',
        Step: 'step',
        StepOption: 'step_option',
        MenuStep: 'menu_step',
        Order: 'order',
        OrderItem: 'order_item',
        Restaurant: 'restaurant',
    }

    for model_class in AUDIT_CONFIG:
        pre_save.connect(_capture_pre_save, sender=model_class,
                         dispatch_uid=f'audit_pre_{model_class.__name__}')
        post_save.connect(_handle_post_save, sender=model_class,
                          dispatch_uid=f'audit_post_{model_class.__name__}')
        post_delete.connect(_handle_post_delete, sender=model_class,
                            dispatch_uid=f'audit_del_{model_class.__name__}')

    logger.info("Audit Trail : signaux enregistres sur %d modeles", len(AUDIT_CONFIG))


# Auto-register au chargement du module
register_audit_signals()
