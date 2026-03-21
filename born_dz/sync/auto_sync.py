# sync/auto_sync.py
# ==========================================
# 🔄 Synchronisation automatique cloud → local
# ==========================================
# Démarre un thread de fond qui récupère périodiquement le snapshot
# depuis le serveur cloud (Railway) et l'applique à la base locale.
# Ne s'exécute que sur le serveur POS local (SQLite, pas Railway).
#
# Activé via AUTO_SYNC_ENABLED=True dans .env
# Intervalle configurable via AUTO_SYNC_INTERVAL_SECONDS (défaut : 300s)

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

_sync_thread = None


def _notify_bornes():
    """Envoie un message WebSocket à toutes les bornes pour qu'elles rechargent le menu."""
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
            logger.info('[AUTO-SYNC] 📡 Notification WebSocket envoyée aux bornes')
    except Exception as e:
        logger.warning(f'[AUTO-SYNC] Impossible de notifier les bornes via WebSocket: {e}')


def _do_sync():
    """Télécharge le snapshot depuis le cloud et l'applique en local."""
    from django.conf import settings
    from restaurant.models import Restaurant
    from sync.views import apply_snapshot_data

    cloud_url = getattr(settings, 'SERVER_BASE_URL', '').rstrip('/')
    if not cloud_url:
        logger.warning('[AUTO-SYNC] SERVER_BASE_URL non défini, sync ignorée')
        return

    restaurants = list(Restaurant.objects.values_list('id', flat=True))
    if not restaurants:
        logger.info('[AUTO-SYNC] Aucun restaurant en base locale, sync ignorée')
        return

    for restaurant_id in restaurants:
        try:
            url = f"{cloud_url}/api/sync/snapshot/?restaurant_id={restaurant_id}"
            logger.info(f'[AUTO-SYNC] Récupération snapshot restaurant {restaurant_id}…')

            req = urllib.request.Request(url, headers={'User-Agent': 'ClickGo-AutoSync/1.0'})
            with urllib.request.urlopen(req, timeout=30) as response:
                snapshot = json.loads(response.read().decode('utf-8'))

            if not snapshot.get('success'):
                logger.warning(f'[AUTO-SYNC] Snapshot échoué: {snapshot.get("error")}')
                continue

            results = apply_snapshot_data(snapshot)
            logger.info(
                f'[AUTO-SYNC] ✅ Snapshot appliqué — restaurant {restaurant_id} | '
                f'menus={results.get("menu", 0)} catégories={results.get("group_menu", 0)} '
                f'récompenses={results.get("loyalty_rewards", 0)}'
            )
            _notify_bornes()

        except urllib.error.URLError as e:
            logger.warning(f'[AUTO-SYNC] Serveur cloud inaccessible (restaurant {restaurant_id}): {e.reason}')
        except ValueError as e:
            logger.warning(f'[AUTO-SYNC] Snapshot vide ou invalide (restaurant {restaurant_id}): {e}')
        except Exception as e:
            logger.error(f'[AUTO-SYNC] Erreur inattendue (restaurant {restaurant_id}): {e}', exc_info=True)


def _sync_loop(interval_seconds):
    """Boucle infinie exécutée dans le thread de fond."""
    # Attendre que le serveur soit complètement démarré
    time.sleep(30)
    logger.info(f'[AUTO-SYNC] Démarrage — sync toutes les {interval_seconds}s')

    while True:
        try:
            _do_sync()
        except Exception as e:
            logger.error(f'[AUTO-SYNC] Erreur dans la boucle de sync: {e}', exc_info=True)
        time.sleep(interval_seconds)


def start_auto_sync():
    """
    Démarre le thread de sync automatique.
    À appeler depuis SyncConfig.ready() uniquement sur le serveur local.
    """
    global _sync_thread

    from django.conf import settings

    if not getattr(settings, 'AUTO_SYNC_ENABLED', False):
        return

    # Évite le double démarrage avec le rechargeur automatique de Django
    if os.environ.get('RUN_MAIN') == 'true':
        return

    if _sync_thread is not None and _sync_thread.is_alive():
        return

    interval = getattr(settings, 'AUTO_SYNC_INTERVAL_SECONDS', 300)
    _sync_thread = threading.Thread(
        target=_sync_loop,
        args=(interval,),
        daemon=True,
        name='clickgo-auto-sync',
    )
    _sync_thread.start()
    logger.info(f'[AUTO-SYNC] Thread démarré (intervalle={interval}s)')
