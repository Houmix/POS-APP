from django.contrib.auth.models import AbstractUser
from django.db import models
from restaurant.models import Restaurant
from django.conf import settings
# Import nécessaire pour le hachage manuel
from django.contrib.auth.hashers import make_password, is_password_usable

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
    REQUIRED_FIELDS = ['email']
    
    username = models.CharField(max_length=150, blank=True, null=True, unique=False)
    
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    phone = models.CharField(max_length=13, unique=True)
    email = models.EmailField(unique=True, blank=True, null=True)
    
    # ❌ SUPPRIMÉ : password = models.CharField(...) 
    # AbstractUser possède déjà ce champ, le redéfinir ici cassait le hachage.

    def save(self, *args, **kwargs):
            if not self.username:
                self.username = self.phone
            if not self.email:
                self.email = f"{self.phone}@born.dz"
     
            # Vérification de la longueur avant le hachage
            if self.password and not (self.password.startswith('pbkdf2_') or self.password.startswith('bcrypt')):
                if len(self.password) != 6:
                    raise ValueError("Le mot de passe doit faire exactement 6 caractères.")
                self.set_password(self.password)
                
            super().save(*args, **kwargs)


class Employee(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.SET_NULL, null=True)
    
    def __str__(self):
        return self.user.phone + " " + self.user.role.role + " " + self.restaurant.name