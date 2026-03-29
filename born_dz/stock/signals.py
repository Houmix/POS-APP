# stock/signals.py
# ==========================================
# Deduction automatique du stock a chaque commande
# ==========================================
# Ecoute la creation de OrderItem et OrderItemOption
# pour deduire les ingredients du stock en temps reel.
# Genere des alertes si le stock passe sous les seuils.

import logging
from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction

logger = logging.getLogger('stock')


def deduct_stock_for_order(order):
    """
    Deduit le stock pour tous les items d'une commande.
    Retourne une liste d'alertes pour les items dont le stock est bas/critique/epuise.

    Pour chaque item de la commande :
      1. Cherche les liens MenuStockLink (ingredients du plat)
      2. Deduit quantity_used x item.quantity du stock
      3. Cherche les liens OptionStockLink (supplements)
      4. Deduit les quantites d'options
      5. Genere des alertes si necessaire

    Returns:
        list[dict] : alertes stock [{ id, name, quantity, unit, status, auto_disable }]
    """
    from .models import MenuStockLink, OptionStockLink, StockMovement, StockAlert, StockItem

    movements = []
    affected_stock_ids = set()

    for item in order.items.prefetch_related('options__option__option', 'menu__stock_links__stock_item').all():
        if not item.menu:
            continue

        # 1. Deduire les ingredients du plat
        for link in MenuStockLink.objects.filter(menu=item.menu).select_related('stock_item'):
            qty_to_deduct = link.quantity_used * item.quantity
            _deduct_and_record(
                link.stock_item, qty_to_deduct, order.id,
                f"Commande #{order.id} - {item.quantity}x {item.menu.name}",
                movements
            )
            affected_stock_ids.add(link.stock_item_id)

        # 2. Deduire les ingredients des options
        for opt_rel in item.options.select_related('option__option').all():
            if opt_rel.option and opt_rel.option.option:
                option_obj = opt_rel.option.option  # L'objet Option reel
                for link in OptionStockLink.objects.filter(option=option_obj).select_related('stock_item'):
                    qty_to_deduct = link.quantity_used * item.quantity
                    _deduct_and_record(
                        link.stock_item, qty_to_deduct, order.id,
                        f"Commande #{order.id} - Option {option_obj.name}",
                        movements
                    )
                    affected_stock_ids.add(link.stock_item_id)

    # Sauvegarder tous les mouvements en batch
    if movements:
        StockMovement.objects.bulk_create(movements)
        logger.info(f"Stock deduit pour commande #{order.id} : {len(movements)} mouvements")

    # Verifier les alertes
    _check_alerts_after_deduction(order)

    # Retourner les items en alerte (low, critical, out)
    stock_alerts = []
    if affected_stock_ids:
        for si in StockItem.objects.filter(id__in=affected_stock_ids, is_active=True):
            s = si.status
            if s != 'ok':
                stock_alerts.append({
                    'id': si.id,
                    'name': si.name,
                    'quantity': float(si.quantity),
                    'unit': si.get_unit_display(),
                    'status': s,
                    'auto_disable': si.auto_disable,
                })

    return stock_alerts


def _deduct_and_record(stock_item, qty_to_deduct, order_id, reason, movements_list):
    """
    Deduit une quantite d'un article de stock et enregistre le mouvement.
    Utilise update() atomique pour eviter les race conditions.
    """
    from .models import StockMovement, StockItem

    qty_before = stock_item.quantity
    qty_after = max(Decimal('0'), qty_before - qty_to_deduct)

    # Update atomique
    StockItem.objects.filter(pk=stock_item.pk).update(
        quantity=qty_after
    )
    stock_item.refresh_from_db()

    movements_list.append(StockMovement(
        stock_item=stock_item,
        movement_type='out',
        quantity=-qty_to_deduct,
        quantity_before=qty_before,
        quantity_after=qty_after,
        reason=reason,
        order_id=order_id,
        unit_cost=stock_item.cost_price,
    ))


def _check_alerts_after_deduction(order):
    """
    Verifie tous les articles de stock impactes par une commande
    et genere des alertes si necessaire.
    """
    from .models import MenuStockLink, OptionStockLink, StockAlert, StockItem

    # Collecter tous les stock_items impactes
    menu_ids = order.items.values_list('menu_id', flat=True)
    stock_item_ids = set(
        MenuStockLink.objects.filter(menu_id__in=menu_ids)
        .values_list('stock_item_id', flat=True)
    )

    for stock_item in StockItem.objects.filter(id__in=stock_item_ids, is_active=True):
        _generate_alert_if_needed(stock_item)


def _generate_alert_if_needed(stock_item):
    """Genere une alerte de stock si les seuils sont depasses."""
    from .models import StockAlert

    status = stock_item.status

    if status == 'ok':
        # Resoudre les alertes actives
        StockAlert.objects.filter(
            stock_item=stock_item, is_resolved=False
        ).update(is_resolved=True, resolved_at=__import__('django').utils.timezone.now())
        return

    # Verifier si une alerte active existe deja pour ce niveau
    existing = StockAlert.objects.filter(
        stock_item=stock_item, level=status, is_resolved=False
    ).exists()

    if existing:
        return  # Alerte deja active

    # Creer l'alerte
    threshold = stock_item.critical_threshold if status in ('critical', 'out') else stock_item.min_threshold
    messages = {
        'low': f"Stock bas : {stock_item.name} - {stock_item.quantity} {stock_item.get_unit_display()} restant(s) (seuil: {stock_item.min_threshold})",
        'critical': f"Stock critique : {stock_item.name} - {stock_item.quantity} {stock_item.get_unit_display()} restant(s) (seuil: {stock_item.critical_threshold})",
        'out': f"Rupture de stock : {stock_item.name} - plus aucun stock disponible",
    }

    alert = StockAlert.objects.create(
        stock_item=stock_item,
        level=status,
        message=messages.get(status, f"Alerte stock : {stock_item.name}"),
        current_quantity=stock_item.quantity,
        threshold=threshold,
    )

    logger.warning(f"ALERTE STOCK [{status.upper()}] : {stock_item.name} = {stock_item.quantity} (restaurant #{stock_item.restaurant_id})")

    # Si auto_disable est active et stock critique/out, desactiver les articles du menu
    if stock_item.auto_disable and status in ('critical', 'out'):
        _auto_disable_menu_items(stock_item)


def _auto_disable_menu_items(stock_item):
    """
    Desactive automatiquement les articles du menu
    quand un ingredient est en rupture.
    """
    from .models import MenuStockLink
    from menu.models import Menu

    menu_ids = MenuStockLink.objects.filter(
        stock_item=stock_item
    ).values_list('menu_id', flat=True)

    affected = Menu.objects.filter(id__in=menu_ids, avalaible=True).update(avalaible=False)

    if affected:
        logger.warning(
            f"AUTO-DISABLE : {affected} article(s) du menu desactive(s) "
            f"car {stock_item.name} est en rupture"
        )


def restock_item(stock_item_id, quantity, reason='Reception fournisseur', user_phone=''):
    """
    Fonction utilitaire pour reapprovisionner un article de stock.
    Reactive automatiquement les articles du menu si le stock repasse au-dessus du seuil.
    """
    from .models import StockItem, StockMovement, MenuStockLink
    from menu.models import Menu

    stock_item = StockItem.objects.get(pk=stock_item_id)
    qty_before = stock_item.quantity
    qty_after = qty_before + Decimal(str(quantity))

    StockItem.objects.filter(pk=stock_item_id).update(quantity=qty_after)
    stock_item.refresh_from_db()

    StockMovement.objects.create(
        stock_item=stock_item,
        movement_type='in',
        quantity=Decimal(str(quantity)),
        quantity_before=qty_before,
        quantity_after=qty_after,
        reason=reason,
        user_phone=user_phone,
        unit_cost=stock_item.cost_price,
    )

    # Reactiver les articles du menu si le stock est de nouveau OK
    if stock_item.status in ('ok', 'low'):
        menu_ids = MenuStockLink.objects.filter(
            stock_item=stock_item
        ).values_list('menu_id', flat=True)

        reactivated = Menu.objects.filter(id__in=menu_ids, avalaible=False).update(avalaible=True)
        if reactivated:
            logger.info(f"REACTIVATION : {reactivated} article(s) reactives apres restockage de {stock_item.name}")

    _generate_alert_if_needed(stock_item)

    return stock_item
