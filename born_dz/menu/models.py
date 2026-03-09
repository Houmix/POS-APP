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

    def __str__(self):
        return self.name + " " + self.restaurant.name


class Menu(models.Model):
    name = models.CharField(max_length=128)
    description = models.CharField(max_length=256)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    solo_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
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

    def __str__(self):
        return self.name + " " + self.group_menu.restaurant.name if self.group_menu else self.name


class Option(models.Model):
    name = models.CharField(max_length=128)
    photo = models.FileField(upload_to="option/photo/", null=True, blank=True)
    # type devient un champ libre (plus de choices fixes) - tag optionnel d'organisation
    type = models.CharField(max_length=50, blank=True, default='')
    avalaible = models.BooleanField(default=True)
    extra_price = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)

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
