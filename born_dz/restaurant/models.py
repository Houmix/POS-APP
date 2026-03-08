
from django.db import models
from chain.models import Chain


class Restaurant(models.Model):
    name = models.CharField(max_length=128)
    address = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    phone = models.CharField(max_length=13)
    immat = models.CharField(max_length=30)
    logo = models.FileField(upload_to="restaurants/logo/", blank=True, null=True)

    chain = models.ForeignKey(Chain, on_delete=models.SET_NULL, null=True, blank=True, related_name="restaurants")

    def __str__(self):
        return self.name


class KioskConfig(models.Model):
    restaurant           = models.OneToOneField(Restaurant, on_delete=models.CASCADE, related_name='kiosk_config')
    # Couleurs de la marque
    primary_color        = models.CharField(max_length=7, default='#0056b3')
    secondary_color      = models.CharField(max_length=7, default='#ff69b4')
    # Fond et textes
    background_color     = models.CharField(max_length=7, default='#F8F9FA')
    card_bg_color        = models.CharField(max_length=7, default='#ffffff')
    text_color           = models.CharField(max_length=7, default='#1e293b')
    # Sidebar / catégories
    sidebar_color              = models.CharField(max_length=7, default='#1e293b')
    category_bg_color          = models.CharField(max_length=7, default='#1e293b')
    selected_category_bg_color = models.CharField(max_length=7, default='#334155')
    category_text_color        = models.CharField(max_length=7, default='#94a3b8')
    # Médias
    logo                 = models.ImageField(upload_to='kiosk/logos/', blank=True, null=True)
    screensaver_video    = models.FileField(upload_to='kiosk/videos/', blank=True, null=True)
    updated_at           = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"KioskConfig for {self.restaurant.name}"

