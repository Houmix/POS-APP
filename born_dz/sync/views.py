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
    # Nettoyage des vieux SyncLog (> 7 jours) pour éviter le bloat
    try:
        from datetime import timedelta
        cutoff = datetime.now(dt_timezone.utc) - timedelta(days=7)
        deleted, _ = SyncLog.objects.filter(created_at__lt=cutoff).delete()
        if deleted:
            print(f"[SYNC] Nettoyage SyncLog : {deleted} entrées supprimées (> 7 jours)")
    except Exception:
        pass

    return JsonResponse({
        'status': 'ok',
        'timestamp': datetime.now(dt_timezone.utc).isoformat()
    })


def discover(request):
    """
    Endpoint de découverte automatique pour les bornes.
    La borne scanne le réseau local et appelle GET /api/sync/discover/
    pour identifier le serveur caisse et récupérer son restaurant_id.
    """
    import socket
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        local_ip = '127.0.0.1'
        hostname = 'caisse'

    from restaurant.models import Restaurant
    restaurant = Restaurant.objects.first()

    return JsonResponse({
        'server': 'caisse',
        'app': 'ClickGo POS',
        'version': '1.0',
        'host': hostname,
        'ip': local_ip,
        'restaurant_id': restaurant.id if restaurant else None,
        'restaurant_name': restaurant.name if restaurant else None,
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

        from restaurant.models import Restaurant
        try:
            int(restaurant_id)
        except ValueError:
            return JsonResponse({'success': False, 'error': 'restaurant_id invalide'}, status=400)

        if not Restaurant.objects.filter(id=int(restaurant_id)).exists():
            return JsonResponse({
                'success': False,
                'error': f'Restaurant {restaurant_id} introuvable sur ce serveur. Vérifiez que le restaurant est bien configuré.'
            }, status=404)

        base_url = request.build_absolute_uri('/').rstrip('/')
        data = full_snapshot(int(restaurant_id), base_url=base_url)
        data['success'] = True
        data['server_timestamp'] = datetime.now(dt_timezone.utc).isoformat()
        return JsonResponse(data)

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[SNAPSHOT] ERREUR: {e}\n{tb}")
        return JsonResponse({'success': False, 'error': str(e), 'traceback': tb.splitlines()[-5:]}, status=500)


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

        # _forwarded=True → émis par un POS local, ne pas re-forwarder
        is_forwarded = body.get('_forwarded', False)

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

    Appelé par le SyncManager Electron sur le Django LOCAL lors de la 1ère sync,
    ou par le bouton "Sync cloud → local" de l'admin web.
    """
    try:
        body = json.loads(request.body)

        # ── 0. S'assurer que le Restaurant existe localement ──────────────────
        restaurant_data = body.get('restaurant', {})
        restaurant_id = restaurant_data.get('id')
        restaurant_name = restaurant_data.get('name', 'Restaurant')

        if restaurant_id:
            from restaurant.models import Restaurant
            restaurant_address = restaurant_data.get('address', '-')
            restaurant_phone = restaurant_data.get('phone', '0000000000')
            restaurant_immat = restaurant_data.get('immat', '-')

            restaurant, _ = Restaurant.objects.get_or_create(
                id=restaurant_id,
                defaults={
                    'name': restaurant_name,
                    'address': restaurant_address,
                    'phone': restaurant_phone,
                    'immat': restaurant_immat,
                }
            )
            # Mettre à jour tous les champs si différents
            update_fields = {}
            if restaurant_name and restaurant.name != restaurant_name:
                update_fields['name'] = restaurant_name
            if restaurant_address and restaurant_address != '-' and restaurant.address != restaurant_address:
                update_fields['address'] = restaurant_address
            if restaurant_phone and restaurant_phone != '0000000000' and restaurant.phone != restaurant_phone:
                update_fields['phone'] = restaurant_phone
            if restaurant_immat and restaurant_immat != '-' and restaurant.immat != restaurant_immat:
                update_fields['immat'] = restaurant_immat
            if update_fields:
                Restaurant.objects.filter(id=restaurant_id).update(**update_fields)

        from menu.models import GroupMenu, Menu, Step, MenuStep, StepOption, Option
        from restaurant.models import KioskConfig
        from user.models import Role, User, Employee
        from customer.models import LoyaltyReward

        results = {}

        # ── Garde : refuser un snapshot vide pour éviter d'effacer les données locales ──
        group_menus_in = body.get('group_menus', [])
        menus_in = body.get('menus', [])
        users_in = body.get('users', [])
        if not group_menus_in and not menus_in and not users_in:
            return JsonResponse({
                'success': False,
                'error': 'Snapshot vide reçu du cloud (0 catégories, 0 menus, 0 utilisateurs). '
                         'Vérifiez que ce restaurant_id existe sur le cloud et qu\'il a des données.'
            }, status=400)

        with transaction.atomic():
            # ── 1. Purger TOUTES les données locales dans l'ordre inverse des FK ──
            if restaurant_id:
                step_ids = list(Step.objects.filter(restaurant_id=restaurant_id).values_list('id', flat=True))
                menu_ids = list(Menu.objects.filter(group_menu__restaurant_id=restaurant_id).values_list('id', flat=True))
                # Collecter les option_ids AVANT de supprimer les StepOptions
                option_ids = list(StepOption.objects.filter(step_id__in=step_ids).values_list('option_id', flat=True).distinct())
                # Supprimer dans l'ordre (dépendances d'abord)
                StepOption.objects.filter(step_id__in=step_ids).delete()
                MenuStep.objects.filter(step_id__in=step_ids).delete()
                MenuStep.objects.filter(menu_id__in=menu_ids).delete()
                Step.objects.filter(restaurant_id=restaurant_id).delete()
                Menu.objects.filter(group_menu__restaurant_id=restaurant_id).delete()
                GroupMenu.objects.filter(restaurant_id=restaurant_id).delete()
                # Supprimer les options de ce restaurant (StepOptions déjà supprimées)
                if option_ids:
                    Option.objects.filter(id__in=option_ids).delete()
                # KioskConfig : ne supprimer que si le snapshot en fournit une nouvelle
                # (sinon on perd les couleurs/logo locaux et get_or_create remet les défauts)
                if body.get('kiosk_config') and isinstance(body.get('kiosk_config'), dict):
                    KioskConfig.objects.filter(restaurant_id=restaurant_id).delete()

            # ── 2. Roles (nécessaires avant les Users) ────────────────────────
            for role_data in body.get('roles', []):
                try:
                    Role.objects.update_or_create(
                        id=role_data['id'],
                        defaults={'role': role_data['role']}
                    )
                except Exception as e:
                    print(f"[APPLY-SNAPSHOT] Erreur role: {e} — data={role_data}")
            results['roles'] = len(body.get('roles', []))

            # ── 3. Users (mot de passe déjà haché — bypass du save() custom) ───
            # Construire un mapping cloud_user_id → local_pk pour les employees
            cloud_id_to_local_pk = {}
            for user_data in users_in:
                try:
                    cloud_uid = user_data['id']
                    phone = user_data['phone']
                    email = user_data.get('email') or f"{phone}@born.dz"
                    username = user_data.get('username') or phone

                    # Chercher par phone d'abord (clé métier), puis par cloud id
                    existing = User.objects.filter(phone=phone).first()
                    if not existing:
                        existing = User.objects.filter(id=cloud_uid).first()

                    if existing:
                        local_pk = existing.pk
                    else:
                        # Créer avec l'id du cloud pour que les FK Employee soient cohérentes
                        # On passe par QuerySet.create pour bypasser le save() custom
                        existing = User.objects.create(
                            id=cloud_uid,
                            phone=phone,
                            email=email,
                            username=username,
                            is_active=user_data.get('is_active', True),
                            is_staff=user_data.get('is_staff', False),
                            is_superuser=user_data.get('is_superuser', False),
                        )
                        local_pk = existing.pk

                    # Mettre à jour via QuerySet.update (bypass le save() pour ne pas re-hacher)
                    User.objects.filter(pk=local_pk).update(
                        username=username,
                        email=email,
                        password=user_data['password'],  # déjà pbkdf2_sha256$...
                        role_id=user_data.get('role_id'),
                        is_active=user_data.get('is_active', True),
                        is_staff=user_data.get('is_staff', False),
                        is_superuser=user_data.get('is_superuser', False),
                    )
                    cloud_id_to_local_pk[cloud_uid] = local_pk
                except Exception as e:
                    print(f"[APPLY-SNAPSHOT] Erreur user {user_data.get('phone')}: {e}")
            results['users'] = len(users_in)

            # ── 4. Employees ───────────────────────────────────────────────────
            for emp_data in body.get('employees', []):
                try:
                    # Résoudre le user_id local (peut différer du cloud_id)
                    cloud_uid = emp_data['user_id']
                    local_user_pk = cloud_id_to_local_pk.get(cloud_uid, cloud_uid)

                    defaults = {
                        'user_id': local_user_pk,
                        'restaurant_id': emp_data.get('restaurant_id'),
                        'first_name': emp_data.get('first_name', ''),
                        'last_name': emp_data.get('last_name', ''),
                        'contract_type': emp_data.get('contract_type', ''),
                        'national_id': emp_data.get('national_id', ''),
                        'address': emp_data.get('address', ''),
                        'monthly_hours': emp_data.get('monthly_hours'),
                    }
                    if emp_data.get('hire_date'):
                        from datetime import date
                        defaults['hire_date'] = date.fromisoformat(emp_data['hire_date'])
                    if emp_data.get('hourly_rate') is not None:
                        defaults['hourly_rate'] = Decimal(str(emp_data['hourly_rate']))

                    Employee.objects.update_or_create(id=emp_data['id'], defaults=defaults)
                except Exception as e:
                    print(f"[APPLY-SNAPSHOT] Erreur employee {emp_data.get('id')}: {e}")
            results['employees'] = len(body.get('employees', []))

            # ── 5. kiosk_config (objet unique, keyed by restaurant_id) ──────────
            config_data = body.get('kiosk_config')
            if config_data and isinstance(config_data, dict):
                try:
                    _apply_change('kiosk_config', 'create', config_data)
                    results['kiosk_config'] = 1
                except Exception as e:
                    print(f"[APPLY-SNAPSHOT] Erreur kiosk_config: {e}")
                    results['kiosk_config'] = 0
            else:
                results['kiosk_config'] = 0

            # ── 6. Insérer catalogue dans l'ordre FK ──────────────────────────
            table_order = ['group_menu', 'menu', 'option', 'step', 'menu_step', 'step_option']
            plurals = {
                'group_menu': 'group_menus',
                'menu': 'menus',
                'option': 'options',
                'step': 'steps',
                'menu_step': 'menu_steps',
                'step_option': 'step_options',
            }

            for table_name in table_order:
                json_key = plurals[table_name]
                items = body.get(json_key, [])
                count = 0
                for item_data in items:
                    try:
                        _apply_change(table_name, 'create', item_data)
                        count += 1
                    except Exception as row_err:
                        print(f"[APPLY-SNAPSHOT] Erreur {table_name}: {row_err} — data={item_data}")
                results[table_name] = count

            # ── 7. LoyaltyReward (récompenses fidélité configurées par le gérant) ──
            if restaurant_id:
                LoyaltyReward.objects.filter(restaurant_id=restaurant_id).delete()
            loyalty_rewards_count = 0
            for reward_data in body.get('loyalty_rewards', []):
                try:
                    _apply_change('loyalty_reward', 'create', reward_data)
                    loyalty_rewards_count += 1
                except Exception as e:
                    print(f"[APPLY-SNAPSHOT] Erreur loyalty_reward: {e} — data={reward_data}")
            results['loyalty_rewards'] = loyalty_rewards_count

        return JsonResponse({'success': True, 'applied': results})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────
#  FORCE REFRESH : Déclenche une mise à jour complète sur toutes les bornes
# ─────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def force_refresh(request):
    """
    Envoie un message WebSocket à toutes les bornes connectées pour
    forcer une synchronisation complète du catalogue.
    Appelé par le POS (caisse) quand le restaurateur clique sur "Rafraîchir".
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from borne_sync.consumers import SYNC_GROUP_NAME

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
        return JsonResponse({'success': True, 'message': 'Sync envoyé à toutes les bornes'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────
#  CLEAR LOCAL : Vide la BDD locale (appelé avant un re-bootstrap)
# ─────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def clear_local(request):
    """
    Supprime toutes les données de menu/config locales pour un restaurant.
    Appelé par le SyncManager Electron avant un force-reset + re-bootstrap.
    """
    try:
        body = json.loads(request.body)
        restaurant_id = body.get('restaurant_id')

        from menu.models import GroupMenu, Menu, Step, MenuStep, StepOption, Option
        from restaurant.models import KioskConfig

        deleted = {}

        with transaction.atomic():
            if restaurant_id:
                # Supprimer en cascade (FK) dans l'ordre inverse
                step_ids = list(Step.objects.filter(restaurant_id=restaurant_id).values_list('id', flat=True))
                so_count, _ = StepOption.objects.filter(step_id__in=step_ids).delete()
                ms_count, _ = MenuStep.objects.filter(step_id__in=step_ids).delete()
                step_count, _ = Step.objects.filter(restaurant_id=restaurant_id).delete()
                menu_count, _ = Menu.objects.filter(group_menu__restaurant_id=restaurant_id).delete()
                gm_count, _ = GroupMenu.objects.filter(restaurant_id=restaurant_id).delete()
                kc_count, _ = KioskConfig.objects.filter(restaurant_id=restaurant_id).delete()
                deleted = {
                    'kiosk_config': kc_count,
                    'group_menus': gm_count,
                    'menus': menu_count,
                    'steps': step_count,
                    'menu_steps': ms_count,
                    'step_options': so_count,
                }

        # Réinitialiser les SyncLog (optionnel, pour repartir propre)
        if restaurant_id:
            SyncLog.objects.filter(restaurant_id=restaurant_id).delete()

        print(f"[SYNC] clear-local restaurant_id={restaurant_id} : {deleted}")
        return JsonResponse({'success': True, 'deleted': deleted})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────
#  HELPER : Applique un changement unitaire
# ─────────────────────────────────────────

def _apply_change(table_name, action, data, restaurant_id=None):
    """
    Applique un changement (create/update/delete) sur le bon modèle Django.
    Gère les types Decimal pour les champs prix.
    Le guard sync_apply_guard empêche les signaux menu de créer des SyncLog
    en boucle lors d'un apply local.
    """
    from sync.signal_guard import sync_apply_guard

    Model = get_model_for_table(table_name)

    # Copie pour ne pas modifier l'original
    clean_data = dict(data)

    # Convertir les champs prix string → Decimal
    decimal_fields = {'price', 'solo_price', 'extra_price', 'total_spent'}
    for field in decimal_fields:
        if field in clean_data and clean_data[field] is not None:
            clean_data[field] = Decimal(str(clean_data[field]))

    # Ignorer les champs auto (auto_now_add / auto_now)
    clean_data.pop('created_at', None)
    clean_data.pop('updated_at', None)

    with sync_apply_guard():
        if action == 'create':
            # KioskConfig : pas d'id dans les données, clé = restaurant_id
            if table_name == 'kiosk_config':
                resto_id = clean_data.pop('restaurant_id', None)
                if resto_id:
                    # Retirer les champs fichier (ne pas écraser un FileField local avec une URL distante)
                    clean_data.pop('logo', None)
                    clean_data.pop('screensaver_video', None)
                    clean_data.pop('screensaver_image', None)
                    # logo_remote_url / screensaver_image_remote_url / screensaver_video_remote_url restent dans clean_data
                    Model.objects.update_or_create(restaurant_id=resto_id, defaults=clean_data)
                return

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


# ─────────────────────────────────────────
#  DOWNLOADS : Téléchargement des logiciels
# ─────────────────────────────────────────
import os
from django.http import FileResponse, HttpResponse
from django.conf import settings as django_settings

DOWNLOADS_DIR = os.path.join(django_settings.BASE_DIR, 'downloads')

DOWNLOAD_META = {
    'ClickGo-POS-Setup.exe':  {'label': 'ClickGo POS (Windows)',  'platform': 'windows', 'icon': 'monitor'},
    'ClickGo-POS.dmg':        {'label': 'ClickGo POS (macOS)',    'platform': 'mac',     'icon': 'monitor'},
    'ClickGo-Borne.apk':      {'label': 'ClickGo Borne (Android)','platform': 'android', 'icon': 'tablet'},
}

@require_http_methods(["GET"])
def downloads_config(request):
    """Retourne la config des téléchargements (URLs GitHub Releases)."""
    from django.conf import settings as s
    return JsonResponse({
        'pos_windows_url': getattr(s, 'GITHUB_RELEASE_POS_URL', ''),
    })


@require_http_methods(["GET"])
def list_downloads(request):
    """Liste les fichiers disponibles au téléchargement."""
    files = []
    if os.path.exists(DOWNLOADS_DIR):
        for filename in sorted(os.listdir(DOWNLOADS_DIR)):
            filepath = os.path.join(DOWNLOADS_DIR, filename)
            if not os.path.isfile(filepath):
                continue
            meta = DOWNLOAD_META.get(filename, {'label': filename, 'platform': 'other', 'icon': 'file'})
            files.append({
                'filename': filename,
                'label': meta['label'],
                'platform': meta['platform'],
                'icon': meta['icon'],
                'size_mb': round(os.path.getsize(filepath) / (1024 * 1024), 1),
                'url': f'/api/downloads/{filename}/',
            })
    return JsonResponse({'files': files})


@require_http_methods(["GET"])
def download_file(request, filename):
    """Sert un fichier de téléchargement."""
    # Sécurité : empêcher path traversal
    safe_name = os.path.basename(filename)
    filepath = os.path.join(DOWNLOADS_DIR, safe_name)
    if not os.path.isfile(filepath):
        return JsonResponse({'error': 'Fichier introuvable'}, status=404)
    return FileResponse(open(filepath, 'rb'), as_attachment=True, filename=safe_name)