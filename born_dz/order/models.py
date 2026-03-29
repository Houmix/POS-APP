from django.db import models
from user.models import User
from restaurant.models import Restaurant
from menu.models import Menu, Option, Step, StepOption
class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('ready', 'Ready'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
        ('refund', 'Refund')
    ]
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="orders")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders", blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    cash = models.BooleanField(default=True)
    paid = models.BooleanField(default=False)
    refund = models.BooleanField(default=False)
    cancelled = models.BooleanField(default=False)
    take_away = models.BooleanField(default=False)
    KDS_STATUS_CHOICES = [
        ('pending_validation', 'En attente de validation'),
        ('new', 'Nouvelle'),
        ('in_progress', 'En préparation'),
        ('done', 'Prête'),
        ('delivered', 'Livrée'),
    ]
    kds_status = models.CharField(max_length=20, choices=KDS_STATUS_CHOICES, default='pending_validation')
    customer_identifier = models.CharField(max_length=100, blank=True, default='')
    DELIVERY_TYPE_CHOICES = [
        ('sur_place', 'Sur place'),
        ('emporter', 'À emporter'),
        ('livraison', 'Livraison'),
    ]
    delivery_type = models.CharField(max_length=20, choices=DELIVERY_TYPE_CHOICES, default='sur_place')
    loyalty_note  = models.TextField(blank=True, default='')  # Récompenses fidélité offertes (noms séparés par virgule)
    def __str__(self):
        return f"Order {self.id} - {self.total_price()} DA"
    def total_price(self):
        total = 0
        # Prefetch pour éviter les requêtes N+1
        items = self.items.select_related('menu').prefetch_related('options__option')
        for item in items:
            item_price = 0
            if item.menu:  # Sécurité critique
                # 1. On prend le prix de base (Solo ou Menu)
                if item.solo or item.extra:
                    item_price = getattr(item.menu, 'solo_price', 0) or 0
                else:
                    item_price = getattr(item.menu, 'price', 0) or 0

            # 2. On y ajoute le prix des options/suppléments de CET item
            for option_rel in item.options.all():
                if option_rel.option and getattr(option_rel.option, 'extra_price', 0):
                    item_price += option_rel.option.extra_price

            # 3. On multiplie le prix unitaire complet par la quantité, puis on ajoute au total de la commande
            total += item_price * item.quantity

        return total

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, null=True, blank=True, related_name="order_items")
    extra = models.BooleanField(default=False)  # Indique si c'est un élément extra (en menu ou solo)
    solo = models.BooleanField(default=False)  # Indique si c'est un élément solo (en menu ou extra)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        menu_name = self.menu.name if self.menu else ("Extra" if self.extra else "Item")
        return f"{self.quantity} x {menu_name} - Order {self.order.id}"


class OrderItemOption(models.Model):
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name="options")
    option = models.ForeignKey(StepOption, on_delete=models.CASCADE)

    def __str__(self):
        option_name = str(self.option) if self.option else "Unknown"
        step_name = self.option.step.name if self.option and self.option.step else "Unknown"
        return f"{option_name} ({step_name}) in {self.order_item}"
