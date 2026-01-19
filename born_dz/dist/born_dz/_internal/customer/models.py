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