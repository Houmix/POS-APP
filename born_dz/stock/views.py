# stock/views.py
# ==========================================
# API de gestion de stock
# ==========================================

import json
from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Sum, Count, Q, F
from django.db import transaction

from .models import (
    StockCategory, StockItem, MenuStockLink, OptionStockLink,
    StockMovement, StockAlert,
)


# ─── STOCK ITEMS ───

@csrf_exempt
@require_http_methods(["GET"])
def stock_list(request):
    """
    Liste tous les articles de stock d'un restaurant.
    Query params: restaurant_id, category_id, status (ok/low/critical/out), search
    """
    restaurant_id = request.GET.get('restaurant_id')
    if not restaurant_id:
        return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

    qs = StockItem.objects.filter(
        restaurant_id=int(restaurant_id), is_active=True
    ).select_related('category')

    # Filtres
    category_id = request.GET.get('category_id')
    if category_id:
        qs = qs.filter(category_id=int(category_id))

    search = request.GET.get('search', '')
    if search:
        qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search))

    status_filter = request.GET.get('status')

    items = []
    for item in qs:
        item_status = item.status
        if status_filter and item_status != status_filter:
            continue
        items.append({
            'id': item.id,
            'name': item.name,
            'sku': item.sku,
            'category': item.category.name if item.category else None,
            'category_id': item.category_id,
            'quantity': float(item.quantity),
            'unit': item.unit,
            'unit_display': item.get_unit_display(),
            'weight_per_unit': float(item.weight_per_unit),
            'total_weight': float(item.total_weight),
            'min_threshold': float(item.min_threshold),
            'critical_threshold': float(item.critical_threshold),
            'auto_disable': item.auto_disable,
            'cost_price': float(item.cost_price),
            'supplier': item.supplier,
            'status': item_status,
            'updated_at': item.updated_at.isoformat() if item.updated_at else None,
        })

    return JsonResponse({'success': True, 'count': len(items), 'items': items})


@csrf_exempt
@require_http_methods(["POST"])
def stock_create(request):
    """Creer un nouvel article de stock."""
    try:
        data = json.loads(request.body)
        restaurant_id = data.get('restaurant_id')
        if not restaurant_id:
            return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

        item = StockItem.objects.create(
            restaurant_id=int(restaurant_id),
            category_id=data.get('category_id'),
            name=data['name'],
            sku=data.get('sku', ''),
            quantity=Decimal(str(data.get('quantity', 0))),
            unit=data.get('unit', 'piece'),
            weight_per_unit=Decimal(str(data.get('weight_per_unit', 0))),
            min_threshold=Decimal(str(data.get('min_threshold', 10))),
            critical_threshold=Decimal(str(data.get('critical_threshold', 3))),
            auto_disable=data.get('auto_disable', True),
            cost_price=Decimal(str(data.get('cost_price', 0))),
            supplier=data.get('supplier', ''),
            supplier_ref=data.get('supplier_ref', ''),
        )

        # Enregistrer le mouvement d'entree initial
        if item.quantity > 0:
            StockMovement.objects.create(
                stock_item=item,
                movement_type='in',
                quantity=item.quantity,
                quantity_before=Decimal('0'),
                quantity_after=item.quantity,
                reason='Stock initial',
            )

        return JsonResponse({'success': True, 'id': item.id, 'name': item.name})

    except (KeyError, InvalidOperation) as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["PUT"])
def stock_update(request):
    """Modifier un article de stock (nom, seuils, fournisseur...)."""
    try:
        data = json.loads(request.body)
        item_id = data.get('id')
        if not item_id:
            return JsonResponse({'success': False, 'error': 'id requis'}, status=400)

        item = StockItem.objects.get(pk=int(item_id))

        for field in ['name', 'sku', 'unit', 'weight_per_unit', 'min_threshold',
                       'critical_threshold', 'auto_disable', 'cost_price',
                       'supplier', 'supplier_ref', 'category_id']:
            if field in data:
                val = data[field]
                if field in ('weight_per_unit', 'min_threshold', 'critical_threshold', 'cost_price'):
                    val = Decimal(str(val))
                setattr(item, field, val)

        item.save()
        return JsonResponse({'success': True, 'id': item.id})

    except StockItem.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Article introuvable'}, status=404)


# ─── MOUVEMENTS DE STOCK ───

@csrf_exempt
@require_http_methods(["POST"])
def stock_restock(request):
    """
    Reapprovisionner un article de stock.
    Body: { stock_item_id, quantity, reason, user_phone }
    """
    try:
        data = json.loads(request.body)
        stock_item_id = data['stock_item_id']
        quantity = Decimal(str(data['quantity']))

        if quantity <= 0:
            return JsonResponse({'success': False, 'error': 'La quantite doit etre positive'}, status=400)

        from .signals import restock_item
        item = restock_item(
            stock_item_id,
            quantity,
            reason=data.get('reason', 'Reception fournisseur'),
            user_phone=data.get('user_phone', ''),
        )

        return JsonResponse({
            'success': True,
            'stock_item_id': item.id,
            'new_quantity': float(item.quantity),
            'status': item.status,
        })

    except (KeyError, StockItem.DoesNotExist, InvalidOperation) as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def stock_adjust(request):
    """
    Ajustement manuel du stock (inventaire, perte, etc.).
    Body: { stock_item_id, new_quantity, reason, type (adjustment/waste) }
    """
    try:
        data = json.loads(request.body)
        stock_item_id = data['stock_item_id']
        new_quantity = Decimal(str(data['new_quantity']))

        item = StockItem.objects.get(pk=int(stock_item_id))
        qty_before = item.quantity
        diff = new_quantity - qty_before

        movement_type = data.get('type', 'adjustment')
        if movement_type not in ('adjustment', 'waste', 'return', 'transfer'):
            movement_type = 'adjustment'

        StockItem.objects.filter(pk=item.pk).update(quantity=new_quantity)

        StockMovement.objects.create(
            stock_item=item,
            movement_type=movement_type,
            quantity=diff,
            quantity_before=qty_before,
            quantity_after=new_quantity,
            reason=data.get('reason', 'Ajustement inventaire'),
            user_phone=data.get('user_phone', ''),
        )

        item.refresh_from_db()
        from .signals import _generate_alert_if_needed
        _generate_alert_if_needed(item)

        return JsonResponse({
            'success': True,
            'stock_item_id': item.id,
            'old_quantity': float(qty_before),
            'new_quantity': float(new_quantity),
            'difference': float(diff),
            'status': item.status,
        })

    except (KeyError, StockItem.DoesNotExist, InvalidOperation) as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["GET"])
def stock_movements(request):
    """
    Historique des mouvements de stock.
    Query params: stock_item_id, restaurant_id, type, days (defaut: 7), limit
    """
    stock_item_id = request.GET.get('stock_item_id')
    restaurant_id = request.GET.get('restaurant_id')
    days = int(request.GET.get('days', 7))
    limit = min(int(request.GET.get('limit', 100)), 500)

    since = datetime.now() - timedelta(days=days)
    qs = StockMovement.objects.filter(created_at__gte=since)

    if stock_item_id:
        qs = qs.filter(stock_item_id=int(stock_item_id))
    elif restaurant_id:
        qs = qs.filter(stock_item__restaurant_id=int(restaurant_id))
    else:
        return JsonResponse({'success': False, 'error': 'stock_item_id ou restaurant_id requis'}, status=400)

    movement_type = request.GET.get('type')
    if movement_type:
        qs = qs.filter(movement_type=movement_type)

    movements = list(qs.select_related('stock_item')[:limit].values(
        'id', 'stock_item__name', 'movement_type', 'quantity',
        'quantity_before', 'quantity_after', 'reason', 'order_id',
        'user_phone', 'unit_cost', 'created_at'
    ))

    return JsonResponse({
        'success': True,
        'count': len(movements),
        'movements': [
            {
                **m,
                'stock_item_name': m.pop('stock_item__name'),
                'quantity': float(m['quantity']),
                'quantity_before': float(m['quantity_before']),
                'quantity_after': float(m['quantity_after']),
                'unit_cost': float(m['unit_cost']),
                'created_at': m['created_at'].isoformat() if m['created_at'] else None,
            }
            for m in movements
        ]
    })


# ─── ALERTES ───

@csrf_exempt
@require_http_methods(["GET"])
def stock_alerts(request):
    """
    Liste des alertes de stock actives.
    Query params: restaurant_id, resolved (true/false)
    """
    restaurant_id = request.GET.get('restaurant_id')
    if not restaurant_id:
        return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

    qs = StockAlert.objects.filter(
        stock_item__restaurant_id=int(restaurant_id)
    ).select_related('stock_item')

    resolved = request.GET.get('resolved')
    if resolved == 'false':
        qs = qs.filter(is_resolved=False)
    elif resolved == 'true':
        qs = qs.filter(is_resolved=True)

    alerts = [
        {
            'id': a.id,
            'stock_item_id': a.stock_item_id,
            'stock_item_name': a.stock_item.name,
            'level': a.level,
            'message': a.message,
            'current_quantity': float(a.current_quantity),
            'threshold': float(a.threshold),
            'is_resolved': a.is_resolved,
            'created_at': a.created_at.isoformat(),
            'resolved_at': a.resolved_at.isoformat() if a.resolved_at else None,
        }
        for a in qs[:100]
    ]

    return JsonResponse({'success': True, 'count': len(alerts), 'alerts': alerts})


# ─── DASHBOARD STOCK ───

@csrf_exempt
@require_http_methods(["GET"])
def stock_dashboard(request):
    """
    Vue d'ensemble du stock pour le dashboard.
    Query params: restaurant_id
    """
    restaurant_id = request.GET.get('restaurant_id')
    if not restaurant_id:
        return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

    items = StockItem.objects.filter(restaurant_id=int(restaurant_id), is_active=True)

    total_items = items.count()
    total_value = sum(float(i.quantity * i.cost_price) for i in items)

    status_counts = {'ok': 0, 'low': 0, 'critical': 0, 'out': 0}
    low_items = []
    for item in items:
        s = item.status
        status_counts[s] += 1
        if s in ('low', 'critical', 'out'):
            low_items.append({
                'id': item.id,
                'name': item.name,
                'quantity': float(item.quantity),
                'unit': item.get_unit_display(),
                'status': s,
            })

    active_alerts = StockAlert.objects.filter(
        stock_item__restaurant_id=int(restaurant_id),
        is_resolved=False
    ).count()

    # Categories avec nombre d'articles
    categories = list(
        StockCategory.objects.filter(restaurant_id=int(restaurant_id))
        .annotate(item_count=Count('items', filter=Q(items__is_active=True)))
        .values('id', 'name', 'item_count')
    )

    return JsonResponse({
        'success': True,
        'total_items': total_items,
        'total_value': round(total_value, 2),
        'status_counts': status_counts,
        'low_stock_items': low_items,
        'active_alerts': active_alerts,
        'categories': categories,
    })


# ─── LIENS MENU-STOCK ───

@csrf_exempt
@require_http_methods(["GET"])
def menu_stock_links(request):
    """Liste les liens ingredient-stock pour un article du menu."""
    menu_id = request.GET.get('menu_id')
    if not menu_id:
        return JsonResponse({'success': False, 'error': 'menu_id requis'}, status=400)

    links = MenuStockLink.objects.filter(
        menu_id=int(menu_id)
    ).select_related('stock_item')

    return JsonResponse({
        'success': True,
        'links': [
            {
                'id': l.id,
                'stock_item_id': l.stock_item_id,
                'stock_item_name': l.stock_item.name,
                'stock_item_unit': l.stock_item.get_unit_display(),
                'stock_item_quantity': float(l.stock_item.quantity),
                'quantity_used': float(l.quantity_used),
            }
            for l in links
        ]
    })


@csrf_exempt
@require_http_methods(["POST"])
def menu_stock_link_create(request):
    """Creer un lien entre un article du menu et un article de stock."""
    try:
        data = json.loads(request.body)
        link = MenuStockLink.objects.create(
            menu_id=data['menu_id'],
            stock_item_id=data['stock_item_id'],
            quantity_used=Decimal(str(data.get('quantity_used', 1))),
        )
        return JsonResponse({'success': True, 'id': link.id})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["DELETE"])
def menu_stock_link_delete(request, link_id):
    """Supprimer un lien menu-stock."""
    try:
        MenuStockLink.objects.filter(pk=link_id).delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


# ─── CATEGORIES ───

@csrf_exempt
@require_http_methods(["GET"])
def category_list(request):
    """Liste les categories de stock."""
    restaurant_id = request.GET.get('restaurant_id')
    if not restaurant_id:
        return JsonResponse({'success': False, 'error': 'restaurant_id requis'}, status=400)

    categories = StockCategory.objects.filter(restaurant_id=int(restaurant_id))
    return JsonResponse({
        'success': True,
        'categories': [
            {'id': c.id, 'name': c.name, 'description': c.description, 'position': c.position}
            for c in categories
        ]
    })


@csrf_exempt
@require_http_methods(["POST"])
def category_create(request):
    """Creer une categorie de stock."""
    try:
        data = json.loads(request.body)
        cat = StockCategory.objects.create(
            restaurant_id=data['restaurant_id'],
            name=data['name'],
            description=data.get('description', ''),
        )
        return JsonResponse({'success': True, 'id': cat.id})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)
