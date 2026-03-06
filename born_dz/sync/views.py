# sync/views.py
# ==========================================
# 🔄 API de synchronisation
# ==========================================
# Endpoints :
#   GET  /api/sync/health/       → vérifie que le serveur est joignable
#   GET  /api/sync/snapshot/     → export complet du catalogue (1ère sync)
#   POST /api/sync/push/         → la borne envoie ses changements (commandes)
#   GET  /api/sync/pull/         → la borne récupère les changements serveur (menus, dispo)
#   POST /api/sync/apply/        → endpoint LOCAL pour appliquer les changements reçus

import json
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction

from .models import SyncLog
from .serializers import (
    full_snapshot,
    get_model_for_table,
    get_serializer_for_table,
    TABLE_REGISTRY,
)


# ─────────────────────────────────────────
#  HEALTH CHECK
# ─────────────────────────────────────────
def health(request):
    """Ping simple pour vérifier la connectivité."""
    return JsonResponse({
        'status': 'ok',
        'timestamp': datetime.now(dt_timezone.utc).isoformat()
    })


def discover(request):
    """
    Endpoint de découverte automatique pour les bornes.
    La borne scanne le réseau local et appelle GET /api/sync/discover/
    pour identifier le serveur caisse.
    """
    import socket
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        local_ip = '127.0.0.1'
        hostname = 'caisse'

    return JsonResponse({
        'server': 'caisse',
        'app': 'ClickGo POS',
        'version': '1.0',
        'host': hostname,
        'ip': local_ip,
    })


# ─────────────────────────────────────────
#  SNAPSHOT (1ère sync / réinitialisation)
# ─────────────────────────────────────────
@require_http_methods(["GET"])
def snapshot(request):
    """
    Retourne l'intégralité du catalogue d'un restaurant.
    Appelé une seule fois lors de l'activation d'une borne,
    ou quand on veut forcer un reset complet.

    Query param : ?restaurant_id=1
    """
    try:
        restaurant_id = request.GET.get('restaurant_id')
        if not restaurant_id:
            return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

        data = full_snapshot(int(restaurant_id))
        data['success'] = True
        data['server_timestamp'] = datetime.now(dt_timezone.utc).isoformat()
        return JsonResponse(data)

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────
#  PUSH : Borne → Serveur (commandes)
# ─────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def push_changes(request):
    """
    Reçoit les changements de la borne et les applique sur le serveur.

    Principalement : des commandes (Order, OrderItem, OrderItemOption).
    Mais aussi potentiellement des mises à jour de statut, etc.

    Body :
    {
        "restaurant_id": 1,
        "terminal_uuid": "BORNE-01-xxx",
        "changes": [
            {
                "table": "order",
                "action": "create",
                "data": { "id": 999, "status": "pending", "cash": true, ... },
                "timestamp": "2025-..."
            },
            {
                "table": "order_item",
                "action": "create",
                "data": { "id": 1234, "order_id": 999, "menu_id": 5, "quantity": 2, ... }
            }
        ]
    }
    """
    try:
        body = json.loads(request.body)
        restaurant_id = body.get('restaurant_id')
        terminal_uuid = body.get('terminal_uuid', '')
        changes = body.get('changes', [])

        if not restaurant_id or not changes:
            return JsonResponse({'success': False, 'error': 'restaurant_id et changes requis'}, status=400)

        accepted = 0
        errors = []

        with transaction.atomic():
            for change in changes:
                try:
                    table = change['table']
                    action = change['action']
                    data = change['data']

                    # Appliquer le changement
                    _apply_change(table, action, data, restaurant_id)

                    # Logger pour que les AUTRES bornes puissent le récupérer
                    SyncLog.objects.create(
                        restaurant_id=restaurant_id,
                        table_name=table,
                        action=action,
                        record_id=data.get('id'),
                        data=data,
                        source='terminal',
                        terminal_uuid=terminal_uuid,
                    )
                    accepted += 1

                except Exception as e:
                    errors.append({
                        'table': change.get('table'),
                        'record_id': change.get('data', {}).get('id'),
                        'error': str(e)
                    })

        return JsonResponse({
            'success': True,
            'accepted': accepted,
            'errors': errors,
            'server_timestamp': datetime.now(dt_timezone.utc).isoformat()
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────
#  PULL : Serveur → Borne (menus, dispos, commandes d'autres bornes)
# ─────────────────────────────────────────
@require_http_methods(["GET"])
def pull_changes(request):
    """
    Renvoie les changements depuis un timestamp donné.
    La borne filtre par terminal_uuid pour ne pas re-recevoir ses propres changements.

    Query params :
        - restaurant_id (obligatoire)
        - since          (ISO timestamp, ex: 2025-01-01T00:00:00Z)
        - terminal_uuid  (pour exclure ses propres changements)
        - tables         (optionnel, filtre: "menu,option,step" — par défaut tout)
    """
    try:
        restaurant_id = request.GET.get('restaurant_id')
        since = request.GET.get('since', '1970-01-01T00:00:00Z')
        terminal_uuid = request.GET.get('terminal_uuid', '')
        tables_filter = request.GET.get('tables', '')

        if not restaurant_id:
            return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

        since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))

        # Requête de base
        qs = SyncLog.objects.filter(
            restaurant_id=restaurant_id,
            created_at__gt=since_dt
        )

        # Exclure les changements émis par cette borne
        if terminal_uuid:
            qs = qs.exclude(terminal_uuid=terminal_uuid)

        # Filtrer par tables si demandé
        if tables_filter:
            table_list = [t.strip() for t in tables_filter.split(',') if t.strip()]
            if table_list:
                qs = qs.filter(table_name__in=table_list)

        logs = qs.order_by('created_at')[:500]

        changes = []
        for log in logs:
            changes.append({
                'table': log.table_name,
                'action': log.action,
                'record_id': log.record_id,
                'data': log.data,
                'source': log.source,
                'timestamp': log.created_at.isoformat(),
            })

        return JsonResponse({
            'success': True,
            'changes': changes,
            'count': len(changes),
            'server_timestamp': datetime.now(dt_timezone.utc).isoformat()
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────
#  APPLY : Endpoint LOCAL uniquement (127.0.0.1:8000)
# ─────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def apply_change(request):
    """
    Appelé par le SyncManager Electron sur le Django LOCAL
    pour appliquer un changement reçu du serveur distant.

    Body : { "table": "menu", "action": "update", "data": { "id": 5, "price": "9.99", ... } }
    """
    try:
        body = json.loads(request.body)
        table = body['table']
        action = body['action']
        data = body['data']

        _apply_change(table, action, data)

        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────
#  APPLY BATCH : Appliquer un snapshot complet
# ─────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def apply_snapshot(request):
    """
    Reçoit un snapshot complet (de /api/sync/snapshot/) et remplace
    toutes les données locales pour ce restaurant.

    Appelé par le SyncManager Electron sur le Django LOCAL lors de la 1ère sync.
    """
    try:
        body = json.loads(request.body)

        # Ordre d'insertion important (respecter les FK)
        table_order = ['group_menu', 'menu', 'option', 'step', 'step_option']
        plurals = {
            'group_menu': 'group_menus',
            'menu': 'menus',
            'option': 'options',
            'step': 'steps',
            'step_option': 'step_options',
        }

        results = {}

        with transaction.atomic():
            for table_name in table_order:
                json_key = plurals[table_name]
                items = body.get(json_key, [])
                Model = get_model_for_table(table_name)

                # Supprimer les anciennes données locales
                if table_name == 'group_menu' and body.get('restaurant', {}).get('id'):
                    Model.objects.filter(restaurant_id=body['restaurant']['id']).delete()
                elif items:
                    existing_ids = [item['id'] for item in items if 'id' in item]
                    # On ne supprime que si on a des données de remplacement
                    # pour éviter de vider par erreur

                # Insérer/mettre à jour
                count = 0
                for item_data in items:
                    _apply_change(table_name, 'create', item_data)
                    count += 1
                results[table_name] = count

        return JsonResponse({'success': True, 'applied': results})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────
#  HELPER : Applique un changement unitaire
# ─────────────────────────────────────────

def _apply_change(table_name, action, data, restaurant_id=None):
    """
    Applique un changement (create/update/delete) sur le bon modèle Django.
    Gère les types Decimal pour les champs prix.
    """
    Model = get_model_for_table(table_name)
    
    # Copie pour ne pas modifier l'original
    clean_data = dict(data)

    # Convertir les champs prix string → Decimal
    decimal_fields = {'price', 'solo_price', 'extra_price'}
    for field in decimal_fields:
        if field in clean_data and clean_data[field] is not None:
            clean_data[field] = Decimal(str(clean_data[field]))

    # Convertir 'created_at' string → on l'ignore (auto_now_add)
    clean_data.pop('created_at', None)

    if action == 'create':
        obj_id = clean_data.get('id')
        if obj_id:
            # update_or_create pour gérer les doublons (idempotent)
            defaults = {k: v for k, v in clean_data.items() if k != 'id'}
            Model.objects.update_or_create(id=obj_id, defaults=defaults)
        else:
            Model.objects.create(**clean_data)

    elif action == 'update':
        obj_id = clean_data.pop('id', None)
        if not obj_id:
            raise ValueError(f"'id' requis pour update sur {table_name}")
        Model.objects.filter(id=obj_id).update(**clean_data)

    elif action == 'delete':
        obj_id = clean_data.get('id')
        if not obj_id:
            raise ValueError(f"'id' requis pour delete sur {table_name}")
        Model.objects.filter(id=obj_id).delete()

    else:
        raise ValueError(f"Action inconnue: {action}")