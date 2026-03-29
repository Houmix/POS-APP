
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
    category_text_color           = models.CharField(max_length=7, default='#94a3b8')
    selected_category_text_color  = models.CharField(max_length=7, default='#ff69b4')
    # Mode d'affichage sidebar
    SIDEBAR_DISPLAY_CHOICES = [
        ('with_image', 'Avec image de catégorie'),
        ('without_image', 'Sans image'),
    ]
    sidebar_display_mode = models.CharField(max_length=20, choices=SIDEBAR_DISPLAY_CHOICES, default='with_image')
    # Médias (fichiers locaux au serveur)
    logo                 = models.ImageField(upload_to='kiosk/logos/', blank=True, null=True)
    screensaver_image    = models.ImageField(upload_to='kiosk/screensaver/', blank=True, null=True)
    screensaver_video    = models.FileField(upload_to='kiosk/videos/', blank=True, null=True)
    # URLs distantes (remplies sur les Django locaux lors de la sync depuis le serveur distant)
    logo_remote_url               = models.URLField(blank=True, null=True)
    screensaver_image_remote_url  = models.URLField(blank=True, null=True)
    screensaver_video_remote_url  = models.URLField(blank=True, null=True)
    # Design des cartes
    CARD_STYLE_CHOICES = [
        ('gradient', 'Gradient sombre'),
        ('macdo', 'MacD (image + barre blanche)'),
        ('magazine', 'Magazine (badge flottant)'),
    ]
    card_style           = models.CharField(max_length=20, choices=CARD_STYLE_CHOICES, default='gradient')
    # Mode de composition : modale intégrée ou page dédiée
    COMPOSITION_MODE_CHOICES = [
        ('modal', 'Modale intégrée'),
        ('page', 'Page dédiée'),
    ]
    composition_mode     = models.CharField(max_length=10, choices=COMPOSITION_MODE_CHOICES, default='page')
    # Fidélité
    loyalty_enabled      = models.BooleanField(default=False)
    loyalty_points_rate  = models.IntegerField(default=10)  # DA par point (10 = 10 DA = 1 point)

    # Mode d'affichage des catégories
    CATEGORY_DISPLAY_CHOICES = [
        ('sidebar', 'Barre latérale (défaut)'),
        ('grid_macdo', 'Grille plein écran (style McDonald\'s)'),
    ]
    category_display_mode = models.CharField(max_length=20, choices=CATEGORY_DISPLAY_CHOICES, default='sidebar')

    # TVA & ticket de caisse
    tva_rate             = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    ticket_header        = models.CharField(max_length=256, blank=True, default='')
    ticket_footer        = models.CharField(max_length=256, blank=True, default='')
    ticket_show_tva      = models.BooleanField(default=False)

    # Mode de livraison autorisé sur la borne
    DELIVERY_MODE_CHOICES = [
        ('both', 'Sur place et emporter'),
        ('sur_place_only', 'Sur place uniquement'),
        ('emporter_only', 'Emporter uniquement'),
    ]
    delivery_modes       = models.CharField(max_length=20, choices=DELIVERY_MODE_CHOICES, default='both')

    # Imprimante cuisine réseau (ESC/POS over TCP)
    kitchen_printer_ip      = models.CharField(max_length=15, blank=True, default='')
    kitchen_printer_port    = models.IntegerField(default=9100)
    kitchen_printer_enabled = models.BooleanField(default=False)

    updated_at           = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"KioskConfig for {self.restaurant.name}"

