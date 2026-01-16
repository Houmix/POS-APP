# menu/signals_sync.py
"""
Signaux UNIQUEMENT pour la synchronisation WebSocket des bornes
À AJOUTER en plus de vos signaux existants (signals.py)
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Menu, GroupMenu

# Nom du groupe WebSocket
SYNC_GROUP_NAME = 'bornes_sync_channel'

def force_borne_reload():
    """
    Fonction simple qui force toutes les bornes à recharger leurs données
    """
    channel_layer = get_channel_layer()
    try:
        async_to_sync(channel_layer.group_send)(
            SYNC_GROUP_NAME,
            {
                'type': 'sync_message',
                'data': {
                    'status': 'full_sync_required',
                }
            }
        )
        print("🔔 [SYNC] Rechargement forcé envoyé aux bornes")
    except Exception as e:
        print(f"❌ [SYNC] Erreur : {e}")


# ==================== SIGNAUX MENUS ====================

@receiver(post_save, sender=Menu)
def menu_changed(sender, instance, created, **kwargs):
    """Quand un menu est créé ou modifié → forcer rechargement"""
    action = "créé" if created else "modifié"
    print(f"🔔 Menu {instance.name} {action} → Rechargement bornes")
    force_borne_reload()


@receiver(post_delete, sender=Menu)
def menu_removed(sender, instance, **kwargs):
    """Quand un menu est supprimé → forcer rechargement"""
    print(f"🔔 Menu {instance.name} supprimé → Rechargement bornes")
    force_borne_reload()


# ==================== SIGNAUX CATÉGORIES ====================

@receiver(post_save, sender=GroupMenu)
def category_changed(sender, instance, created, **kwargs):
    """Quand une catégorie est créée ou modifiée → forcer rechargement"""
    action = "créée" if created else "modifiée"
    print(f"🔔 Catégorie {instance.name} {action} → Rechargement bornes")
    force_borne_reload()


@receiver(post_delete, sender=GroupMenu)
def category_removed(sender, instance, **kwargs):
    """Quand une catégorie est supprimée → forcer rechargement"""
    print(f"🔔 Catégorie {instance.name} supprimée → Rechargement bornes")
    force_borne_reload()