from django.db import models
from restaurant.models import Restaurant


class GroupMenu(models.Model):
    name = models.CharField(max_length=128)
    photo = models.FileField(upload_to="restaurant/menugroup/", null=True, blank=True)
    description = models.CharField(max_length=128)
    avalaible = models.BooleanField(default=True)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="groupmenus")
    extra = models.BooleanField(default=False)
    position = models.IntegerField(default=0)
    # Versioning pour la resolution de conflits de synchronisation
    version = models.IntegerField(default=1, help_text="Incremente a chaque modification pour detecter les conflits")
    updated_at = models.DateTimeField(auto_now=True, help_text="Derniere modification")

    def __str__(self):
        return self.name + " " + self.restaurant.name


class Menu(models.Model):
    name = models.CharField(max_length=128)
    description = models.CharField(max_length=256)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    solo_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    promo_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Prix promotionnel fixe (prioritaire sur le pourcentage)")
    promo_percentage = models.IntegerField(null=True, blank=True, help_text="Réduction en pourcentage (ex: 20 pour -20%). Ignoré si promo_price est défini.")
    PROMO_DISPLAY_CHOICES = [
        ('strikethrough', 'Prix barré + nouveau prix'),
        ('badge', 'Badge -X% sur la carte'),
        ('banner', 'Bandeau PROMO sur l\'image'),
        ('duo', 'Ancien / Nouveau côte à côte'),
        ('minimal', 'Prix promo seul (discret)'),
    ]
    promo_display = models.CharField(max_length=20, choices=PROMO_DISPLAY_CHOICES, default='strikethrough', blank=True, help_text="Type d'affichage de la promotion")
    photo = models.FileField(upload_to="restaurant/menu/", null=True, blank=True)
    group_menu = models.ForeignKey("GroupMenu", on_delete=models.SET_NULL, null=True, blank=True, related_name="menus")
    avalaible = models.BooleanField(default=True)
    extra = models.BooleanField(default=False)
    position = models.IntegerField(default=0)
    TYPE = [
        ('burger', 'Burger'),
        ('sandwich', 'Sandwich'),
        ('wrap', 'Wrap'),
        ('salad', 'Salad'),
        ('plate', 'Plate'),
        ('dessert', 'Dessert'),
        ('drink', 'Drink'),
        ('individual', 'Article individuel'),
    ]
    type = models.CharField(choices=TYPE, max_length=20)
    show_in_crosssell = models.BooleanField(default=False)
    offer_menu_choice = models.BooleanField(default=True)
    skip_kds = models.BooleanField(default=False, help_text="Ne pas envoyer cet article à l'écran cuisine (KDS). Ex : boissons, articles sans préparation.")
    # Versioning pour la resolution de conflits de synchronisation
    version = models.IntegerField(default=1, help_text="Incremente a chaque modification pour detecter les conflits")
    updated_at = models.DateTimeField(auto_now=True, help_text="Derniere modification")

    def __str__(self):
        if self.group_menu:
            return self.name + " " + self.group_menu.restaurant.name
        return self.name


class Option(models.Model):
    name = models.CharField(max_length=128)
    photo = models.FileField(upload_to="option/photo/", null=True, blank=True)
    # type devient un champ libre (plus de choices fixes) - tag optionnel d'organisation
    type = models.CharField(max_length=50, blank=True, default='')
    avalaible = models.BooleanField(default=True)
    extra_price = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    # Versioning
    version = models.IntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Step(models.Model):
    """Étape au niveau restaurant — réutilisable dans plusieurs menus."""
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='steps')
    name = models.CharField(max_length=128)
    max_options = models.IntegerField(default=1)
    avalaible = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class MenuStep(models.Model):
    """Liaison Menu ↔ Step avec ordre et visibilité solo/full propres à ce menu."""
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name='menu_steps')
    step = models.ForeignKey(Step, on_delete=models.CASCADE, related_name='menu_steps')
    number = models.IntegerField(default=0)
    show_for_solo = models.BooleanField(default=True)
    show_for_full = models.BooleanField(default=True)

    class Meta:
        unique_together = ('menu', 'step')
        ordering = ['number']

    def __str__(self):
        return f"{self.menu.name} → {self.step.name}"


class StepOption(models.Model):
    step = models.ForeignKey(Step, on_delete=models.CASCADE, related_name="stepoptions")
    option = models.ForeignKey(Option, on_delete=models.CASCADE, related_name="option")
    avalaible = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    extra_price = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ("step", "option")

    def __str__(self):
        return f"{self.step} - {self.option}"
