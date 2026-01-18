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
    # ✅ CORRECTION CRITIQUE : Définir phone comme USERNAME_FIELD
    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = ['email']  # Champs requis en plus de USERNAME_FIELD
    
    # ✅ CORRECTION : Rendre username non obligatoire et non unique
    username = models.CharField(max_length=150, blank=True, null=True, unique=False)
    
    # Champs personnalisés
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    phone = models.CharField(max_length=13, unique=True)
    email = models.EmailField(unique=True, blank=True, null=True)
    password = models.CharField(max_length=256)
    
    def save(self, *args, **kwargs):
        # ✅ Générer email automatiquement si vide
        if not self.email or self.email == f"{self.phone}@born.dz":
            self.email = f"{self.phone}@born.dz"
        
        # ✅ Générer username automatique (égal au phone)
        if not self.username:
            self.username = self.phone
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.phone + " " + str(self.role)


class Employee(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.SET_NULL, null=True)
    
    def __str__(self):
        return self.user.phone + " " + self.user.role.role + " " + self.restaurant.name