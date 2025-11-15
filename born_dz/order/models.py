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
    def __str__(self):
        return f"Order {self.id} - {self.total_price()} DA"
    def total_price(self):
        total = 0
        for item in self.items.all():
            total += item.menu.price * item.quantity if item.menu and not(item.solo) else 0
            total += item.menu.solo_price * item.quantity if item.menu and (item.solo or item.extra) else 0
            for option in item.options.all():
                total += option.option.extra_price if option.option.extra_price else 0
        return total


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, null=True, blank=True, related_name="order_items")
    extra = models.BooleanField(default=False)  # Indique si c'est un élément extra (en menu ou solo)
    solo = models.BooleanField(default=False)  # Indique si c'est un élément solo (en menu ou extra)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.quantity} x {self.menu.name or self.extra.name} - Order {self.order.id}"


class OrderItemOption(models.Model):
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name="options")
    option = models.ForeignKey(StepOption, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.option.__str__()} ({self.option.step.name}) in {self.order_item}"
