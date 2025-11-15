from django.contrib.auth.models import AbstractUser
from django.db import models
from restaurant.models import Restaurant
from django.conf import settings
from django.contrib.auth.hashers import make_password

class Role(models.Model):
    ROLE_CHOICES = [
        ('customer', 'Customer'),
        ('manager', 'Manager'),
        ('cashier', 'Cashier'),
        ('owner', 'Owner')
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    def __str__(self):
        return str(self.id) + " " + self.role
    
class User(AbstractUser):
    USERNAME_FIELD = 'phone'
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    phone = models.CharField(max_length=13, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=256)
    def save(self, *args, **kwargs):
        # Vérifie si le mot de passe n'est pas déjà hashé pour l'employé
        if self.role and self.role.role in ["manager", "cashier", "owner"]:
            if not self.password.startswith('pbkdf2_'):
                self.password = make_password(self.password)
        else:
            self.password = make_password(self.phone)
            self.email = {self.phone + "@born.dz"}
        super().save(*args, **kwargs)
    def __str__(self):
        return self.phone + " " + str(self.role)  # Updated to use ForeignKey
    


class Employee(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.SET_NULL, null=True)
    
    def __str__(self):
        return self.user.phone + " " + self.user.role.role + " " + self.restaurant.name  # Updated to use ForeignKey
 

