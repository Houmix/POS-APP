from django.db import models
from restaurant.models import Restaurant
# Create your models here.

class GroupMenu(models.Model):
    name = models.CharField(max_length=128)
    photo = models.FileField(upload_to="restaurant/menugroup/", null=True, blank=True)
    description = models.CharField(max_length=128)
    avalaible = models.BooleanField(default=True)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="groupmenus")
    extra = models.BooleanField(default=False)  # Indique si c'est un menu solo ou un extra
    def __str__(self):
        return self.name + " " + self.restaurant.name

class Menu(models.Model):
    name = models.CharField(max_length=128)
    description = models.CharField(max_length=256)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    solo_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Prix pour le menu solo
    photo = models.FileField(upload_to="restaurant/menu/", null=True, blank=True)
    group_menu = models.ForeignKey("GroupMenu", on_delete=models.SET_NULL, null=True, blank=True, related_name="menus")
    avalaible = models.BooleanField(default=True)
    extra = models.BooleanField(default=False)  # Indique si c'est un menu solo ou un extra
    TYPE = [
        ('burger', 'Burger'),
        ('sandwich', 'Sandwich'),
        ('wrap', 'Wrap'),
        ('salad', 'Salad'),
        ('plate', 'Plate'),
        ('dessert', 'Dessert'),
        ('drink', 'Drink')
    ]
    type = models.CharField(choices=TYPE, max_length=20)
    def __str__(self):
        return self.name + " " + self.group_menu.restaurant.name if self.group_menu else self.name

class Option(models.Model):
    name = models.CharField(max_length=128)
    photo = models.FileField(upload_to="option/photo/", null=True, blank=True)
    TYPE = [
        ('pain', 'Pain'),
        ('crudité', 'Crudité'),
        ('accompagnement', 'Accompagnement'),
        ('sauce', 'Sauce'),
        ('boisson','Boisson'),
        ('dessert', 'Dessert'),
        ('base', 'Base'),
        ('protéine', 'Protéine'),
        ('salad', 'Salad'),
        ('plate', 'Plate'),
        ('drink', 'Drink')
    ]
    type = models.CharField(choices=TYPE,max_length=20)
    avalaible = models.BooleanField(default=True)
    extra_price = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)

    def __str__(self):
        return self.name


class Step(models.Model):
    name = models.CharField(max_length=128)
    number = models.IntegerField()
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name="steps")
    max_options = models.IntegerField(default=1)
    TYPE = [
        ('pain', 'Pain'),
        ('crudité', 'Crudité'),
        ('accompagnement', 'Accompagnement'),
        ('sauce', 'Sauce'),
        ('boisson','Boisson'),
        ('dessert', 'Dessert'),
        ('base', 'Base'),
        ('protéine', 'Protéine'),
        ('salad', 'Salad'),
        ('plate', 'Plate'),
        ('drink', 'Drink')
    ]
    type = models.CharField(choices=TYPE, max_length=20)
    avalaible = models.BooleanField(default=True)
    
    def __str__(self):
        return f"Step {self.number} : {self.name}"
    
class StepOption(models.Model):
    step = models.ForeignKey(Step, on_delete=models.CASCADE,related_name="stepoptions")
    option = models.ForeignKey(Option, on_delete=models.CASCADE, related_name="option")

    avalaible = models.BooleanField(default=True)

    is_default = models.BooleanField(default=False)
    extra_price = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ("step", "option")  # Empêche les doublons

    def __str__(self):
        return f"{self.step} - {self.option}"