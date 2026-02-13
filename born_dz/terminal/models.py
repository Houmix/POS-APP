from django.db import models
from restaurant.models import Restaurant

import uuid
from django.db import models
from django.utils import timezone


class License(models.Model):
    PLAN_CHOICES = [
        ('starter', 'Starter (1 borne)'),
        ('standard', 'Standard (3 bornes)'),
        ('premium', 'Premium (10 bornes)'),
        ('enterprise', 'Enterprise (illimité)'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspendue'),
        ('expired', 'Expirée'),
        ('revoked', 'Révoquée'),
    ]

    key = models.CharField(max_length=50, unique=True, db_index=True)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='licenses')
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='standard')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    max_terminals = models.IntegerField(default=3)
    features = models.JSONField(default=list, blank=True, help_text="Ex: ['kds', 'analytics', 'multi_language']")
    
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.key} ({self.restaurant.name}) - {self.status}"

    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    @property
    def active_terminals_count(self):
        return self.activations.filter(is_active=True).count()

    @property
    def can_activate_more(self):
        return self.active_terminals_count < self.max_terminals

    @staticmethod
    def generate_key():
        # Génère une clé du style : DOEAT-A1B2-C3D4-E5F6
        raw = uuid.uuid4().hex[:12].upper()
        return f"CLICKGO-{raw[:4]}-{raw[4:8]}-{raw[8:12]}"


class LicenseActivation(models.Model):
    license = models.ForeignKey(License, on_delete=models.CASCADE, related_name='activations')
    machine_id = models.CharField(max_length=64, db_index=True)
    machine_name = models.CharField(max_length=200, blank=True)
    app_version = models.CharField(max_length=20, blank=True)
    platform = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    
    activated_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['license', 'machine_id']

    def __str__(self):
        status = "active" if self.is_active else "inactive"
        return f"{self.machine_name} ({status})"
    
class Terminal(models.Model):
    restaurant = models.ForeignKey(Restaurant,on_delete=models.CASCADE,related_name="terminals")
    license_key = models.ForeignKey(License, on_delete=models.CASCADE, related_name="terminals")
    name = models.CharField(max_length=255)
    uuid = models.CharField(max_length=255, unique=True)
    def __str__(self):
        return f"{self.name} - {self.restaurant.name}"
    
