# ==========================================
# 🔑 LICENSE VIEWS
# ==========================================
# Ces views utilisent les modèles License, LicenseActivation et Terminal
# que vous avez DÉJÀ dans votre app 'terminal'.
#
# OPTION A : Ajouter ces views dans terminal/views.py
# OPTION B : Créer un fichier terminal/license_views.py et l'inclure
#
# URLs à ajouter dans terminal/urls.py (ou born_dz/urls.py) :
#   path('api/license/', include('terminal.license_urls')),

import json
from datetime import datetime, timezone as dt_timezone

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone

# ⚠️ Vos modèles existants dans l'app terminal
from terminal.models import License, LicenseActivation, Terminal


@csrf_exempt
@require_http_methods(["POST"])
def activate(request):
    """
    Active une licence sur une machine (borne).
    
    Body :
    {
        "license_key": "DOEAT-XXXX-XXXX-XXXX",
        "machine_id": "abc123def456...",
        "machine_name": "BORNE-CAISSE-01",
        "app_version": "1.0.0",
        "platform": "win32-x64"
    }
    """
    try:
        body = json.loads(request.body)
        license_key = body.get('license_key', '').strip()
        machine_id = body.get('machine_id', '').strip()
        machine_name = body.get('machine_name', '')
        app_version = body.get('app_version', '')
        platform = body.get('platform', '')

        if not license_key or not machine_id:
            return JsonResponse({
                'success': False, 'error': 'license_key et machine_id requis'
            }, status=400)

        # 1. Trouver la licence
        try:
            lic = License.objects.get(key=license_key)
        except License.DoesNotExist:
            return JsonResponse({
                'success': False, 'error': 'Clé de licence invalide'
            }, status=404)

        # 2. Vérifier le statut
        if lic.status != 'active':
            return JsonResponse({
                'success': False,
                'error': f'Licence {lic.get_status_display()}',
                'status': lic.status
            }, status=403)

        # 3. Vérifier expiration
        if lic.is_expired:
            lic.status = 'expired'
            lic.save()
            return JsonResponse({
                'success': False, 'error': 'Licence expirée', 'status': 'expired'
            }, status=403)

        # 4. Vérifier les slots disponibles
        existing = LicenseActivation.objects.filter(
            license=lic, machine_id=machine_id
        ).first()

        if existing and existing.is_active:
            # Déjà activé → refresh
            existing.last_seen = timezone.now()
            existing.app_version = app_version
            existing.save()

        elif existing and not existing.is_active:
            # Réactivation
            if not lic.can_activate_more:
                return JsonResponse({
                    'success': False,
                    'error': f'Limite de bornes atteinte ({lic.max_terminals} max, {lic.active_terminals_count} actives)',
                    'max_terminals': lic.max_terminals,
                    'active_count': lic.active_terminals_count
                }, status=403)
            existing.is_active = True
            existing.deactivated_at = None
            existing.app_version = app_version
            existing.platform = platform
            existing.machine_name = machine_name
            existing.save()

        else:
            # Nouvelle activation
            if not lic.can_activate_more:
                return JsonResponse({
                    'success': False,
                    'error': f'Limite de bornes atteinte ({lic.max_terminals} max, {lic.active_terminals_count} actives)',
                    'max_terminals': lic.max_terminals,
                    'active_count': lic.active_terminals_count
                }, status=403)
            LicenseActivation.objects.create(
                license=lic,
                machine_id=machine_id,
                machine_name=machine_name,
                app_version=app_version,
                platform=platform,
            )

        # 5. Créer/MAJ le Terminal associé si pas déjà fait
        Terminal.objects.update_or_create(
            uuid=machine_id,
            defaults={
                'restaurant': lic.restaurant,
                'license_key': lic,
                'name': machine_name or f'Borne-{machine_id[:8]}',
            }
        )

        return JsonResponse({
            'success': True,
            'activated_at': timezone.now().isoformat(),
            'expires_at': lic.expires_at.isoformat() if lic.expires_at else None,
            'restaurant_id': lic.restaurant_id,
            'restaurant_name': lic.restaurant.name,
            'plan': lic.plan,
            'features': lic.features,
            'max_terminals': lic.max_terminals,
            'active_count': lic.active_terminals_count,
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def deactivate(request):
    """
    Désactive une licence sur une machine.
    Libère le slot pour pouvoir activer sur une autre borne.
    
    Body : { "license_key": "DOEAT-...", "machine_id": "abc123..." }
    """
    try:
        body = json.loads(request.body)
        license_key = body.get('license_key', '').strip()
        machine_id = body.get('machine_id', '').strip()

        activation = LicenseActivation.objects.filter(
            license__key=license_key,
            machine_id=machine_id,
            is_active=True
        ).first()

        if activation:
            activation.is_active = False
            activation.deactivated_at = timezone.now()
            activation.save()

        # Désactiver aussi le Terminal
        Terminal.objects.filter(uuid=machine_id).update(
            name=f'[Désactivé] {machine_id[:8]}'
        )

        return JsonResponse({'success': True, 'message': 'Licence désactivée sur cette machine'})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def verify(request):
    """
    Vérifie qu'une licence est toujours valide pour une machine donnée.
    Appelé périodiquement par le LicenseManager côté Electron.
    
    Body : { "license_key": "DOEAT-...", "machine_id": "abc123..." }
    """
    try:
        body = json.loads(request.body)
        license_key = body.get('license_key', '').strip()
        machine_id = body.get('machine_id', '').strip()

        # 1. Licence existe ?
        try:
            lic = License.objects.get(key=license_key)
        except License.DoesNotExist:
            return JsonResponse({'valid': False, 'reason': 'unknown_key'})

        # 2. Expirée ?
        if lic.is_expired:
            lic.status = 'expired'
            lic.save()
            return JsonResponse({'valid': False, 'reason': 'expired', 'status': 'expired'})

        # 3. Active ?
        if lic.status != 'active':
            return JsonResponse({'valid': False, 'reason': lic.status, 'status': lic.status})

        # 4. Machine activée ?
        activation = LicenseActivation.objects.filter(
            license=lic, machine_id=machine_id, is_active=True
        ).first()

        if not activation:
            return JsonResponse({'valid': False, 'reason': 'not_activated'})

        # 5. OK → mettre à jour last_seen
        activation.last_seen = timezone.now()
        activation.save()

        return JsonResponse({
            'valid': True,
            'status': 'active',
            'expires_at': lic.expires_at.isoformat() if lic.expires_at else None,
            'plan': lic.plan,
            'features': lic.features,
            'restaurant_id': lic.restaurant_id,
        })

    except Exception as e:
        return JsonResponse({'valid': False, 'reason': str(e)}, status=500)


@require_http_methods(["GET"])
def restaurant_status(request):
    """
    Vérifie si un restaurant possède une licence valide.
    Utilisé par la borne (Expo) pour vérifier la licence au démarrage
    sans avoir besoin de la clé de licence elle-même.

    Query param : ?restaurant_id=1
    """
    try:
        restaurant_id = request.GET.get('restaurant_id', '').strip()
        if not restaurant_id:
            return JsonResponse({'valid': False, 'reason': 'restaurant_id requis'}, status=400)

        lic = License.objects.filter(
            restaurant_id=restaurant_id,
            status='active',
        ).first()

        if not lic:
            return JsonResponse({'valid': False, 'reason': 'no_active_license'})

        if lic.is_expired:
            return JsonResponse({'valid': False, 'reason': 'expired'})

        return JsonResponse({
            'valid': True,
            'plan': lic.plan,
            'restaurant_id': lic.restaurant_id,
            'expires_at': lic.expires_at.isoformat() if lic.expires_at else None,
            'features': lic.features,
        })

    except Exception as e:
        return JsonResponse({'valid': False, 'reason': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def create_or_renew(request):
    """
    Crée ou renouvelle une licence pour un restaurant.
    Utilisé depuis le site admin pour attribuer une durée de validité.

    Body :
    {
        "restaurant_id": 1,
        "plan": "standard",
        "duration_months": 6,   // 1, 3, 6, 12, 24, 36
        "max_terminals": 3
    }
    """
    try:
        body = json.loads(request.body)
        restaurant_id = body.get('restaurant_id')
        plan = body.get('plan', 'standard')
        duration_months = int(body.get('duration_months', 12))
        max_terminals = int(body.get('max_terminals', 3))

        if not restaurant_id:
            return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

        from datetime import timedelta
        from restaurant.models import Restaurant

        try:
            restaurant = Restaurant.objects.get(id=restaurant_id)
        except Restaurant.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Restaurant introuvable'}, status=404)

        # Cherche une licence existante active
        lic = License.objects.filter(restaurant=restaurant, status__in=['active', 'expired']).first()

        now = timezone.now()

        if lic:
            # Renouvellement : on repart de maintenant (ou de l'expiration future si encore valide)
            base = max(now, lic.expires_at) if lic.expires_at and lic.expires_at > now else now
            lic.expires_at = base + timedelta(days=duration_months * 30)
            lic.status = 'active'
            lic.plan = plan
            lic.max_terminals = max_terminals
            lic.save()
        else:
            # Création d'une nouvelle licence
            lic = License.objects.create(
                key=License.generate_key(),
                restaurant=restaurant,
                plan=plan,
                status='active',
                max_terminals=max_terminals,
                expires_at=now + timedelta(days=duration_months * 30),
            )

        return JsonResponse({
            'success': True,
            'key': lic.key,
            'restaurant_id': restaurant.id,
            'restaurant_name': restaurant.name,
            'plan': lic.plan,
            'status': lic.status,
            'expires_at': lic.expires_at.isoformat(),
            'max_terminals': lic.max_terminals,
        })

    except (ValueError, TypeError) as e:
        return JsonResponse({'success': False, 'error': f'Paramètre invalide: {e}'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def sync_local(request):
    """
    Appelé par le LicenseManager Electron après activation/vérification réussie
    sur le serveur distant. Met à jour le SQLite LOCAL avec les données de licence
    pour que l'app Expo puisse faire son /api/license/restaurant-status/ localement.

    Body :
    {
        "restaurant_id": 1,
        "restaurant_name": "Mon Restaurant",
        "plan": "standard",
        "features": [],
        "expires_at": "2026-01-01T00:00:00+00:00",
        "status": "active"
    }
    """
    try:
        body = json.loads(request.body)
        restaurant_id = body.get('restaurant_id')
        plan = body.get('plan', 'standard')
        features = body.get('features', [])
        expires_at_raw = body.get('expires_at')
        status = body.get('status', 'active')

        if not restaurant_id:
            return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

        from restaurant.models import Restaurant
        from datetime import timedelta

        # Récupère ou crée le restaurant localement
        restaurant, _ = Restaurant.objects.get_or_create(
            id=restaurant_id,
            defaults={'name': body.get('restaurant_name', f'Restaurant #{restaurant_id}')}
        )

        # Parse expires_at
        expires_at = None
        if expires_at_raw:
            try:
                expires_at = datetime.fromisoformat(expires_at_raw.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                pass

        # Cherche une licence active/existante pour ce restaurant
        lic = License.objects.filter(restaurant=restaurant).order_by('-created_at').first()

        if lic:
            # Mise à jour
            lic.plan = plan
            lic.features = features
            lic.expires_at = expires_at
            lic.status = status
            lic.max_terminals = 99  # illimité côté local (la vraie limite est sur le serveur distant)
            lic.save()
            created = False
        else:
            # Création avec une clé placeholder locale
            lic = License.objects.create(
                key=License.generate_key(),
                restaurant=restaurant,
                plan=plan,
                features=features,
                expires_at=expires_at,
                status=status,
                max_terminals=99,
            )
            created = True

        return JsonResponse({
            'success': True,
            'created': created,
            'restaurant_id': restaurant_id,
            'plan': lic.plan,
            'expires_at': lic.expires_at.isoformat() if lic.expires_at else None,
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["GET"])
def info(request):
    """
    Renvoie les infos publiques d'une licence (sans l'activer).
    Utile pour afficher le plan, les features, etc. dans l'admin.
    
    Query param : ?key=DOEAT-XXXX-XXXX-XXXX
    """
    try:
        key = request.GET.get('key', '').strip()
        if not key:
            return JsonResponse({'success': False, 'error': 'key requis'}, status=400)

        try:
            lic = License.objects.get(key=key)
        except License.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Licence introuvable'}, status=404)

        activations = LicenseActivation.objects.filter(license=lic, is_active=True)

        return JsonResponse({
            'success': True,
            'key': lic.key,
            'restaurant': lic.restaurant.name,
            'plan': lic.plan,
            'status': lic.status,
            'max_terminals': lic.max_terminals,
            'active_terminals': lic.active_terminals_count,
            'expires_at': lic.expires_at.isoformat() if lic.expires_at else None,
            'features': lic.features,
            'machines': [
                {
                    'name': a.machine_name,
                    'platform': a.platform,
                    'last_seen': a.last_seen.isoformat(),
                    'activated_at': a.activated_at.isoformat(),
                }
                for a in activations
            ]
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)