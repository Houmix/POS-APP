from django.db import models
from user.models import User
from restaurant.models import Restaurant


# class Customer(models.Model):
#     user = models.OneToOneField(User, on_delete=models.CASCADE)
#     phone = models.CharField(max_length=15)
#     created_at = models.DateTimeField(auto_now_add=True)
class Loyalty(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE)
    point = models.IntegerField(default=0)


class CustomerLoyalty(models.Model):
    """Fidélité client identifié par numéro de téléphone (borne sans compte)."""
    customer_identifier = models.CharField(max_length=64)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE)
    points = models.IntegerField(default=0)
    total_spent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    visit_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('customer_identifier', 'restaurant')

    def __str__(self):
        return f'{self.customer_identifier} @ {self.restaurant_id} — {self.points} pts'


class LoyaltyReward(models.Model):
    """Récompense échangeable contre des points."""
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    points_required = models.IntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.points_required} pts)'


class LoyaltyRedemption(models.Model):
    """Historique des échanges de points."""
    customer_loyalty = models.ForeignKey(CustomerLoyalty, on_delete=models.CASCADE, related_name='redemptions')
    reward = models.ForeignKey(LoyaltyReward, on_delete=models.CASCADE)
    points_spent = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.customer_loyalty.customer_identifier} → {self.reward.name}'