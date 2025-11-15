from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Menu, Step, Option, StepOption, GroupMenu

@receiver(post_save, sender=Menu)
def create_default_steps(sender, instance, created, **kwargs):
    if created and instance.extra == False:  # Vérifie si le menu vient d'être créé et n'est pas un menu solo
        if instance.type in ["burger","sandwich","wrap"]:  # Vérifie si le menu vient d'être créé
            default_steps = [
                {"name": "Pain", "number": 1, "type": "pain", "max_options": 1},
                {"name": "Crudité", "number": 2, "type": "crudité", "max_options": 3},
                {"name": "Accompagnement", "number": 3, "type": "accompagnement", "max_options": 1},
                {"name": "Sauce", "number": 4, "type": "sauce", "max_options": 2},
                {"name": "Boisson", "number": 5, "type": "boisson", "max_options": 1},
            ]
        elif instance.type == "salad":
            default_steps = [
                {"name": "Base", "number": 1, "type": "crudité", "max_options": 3},
                {"name": "Protéine", "number": 2, "type": "accompagnement", "max_options": 1},
                {"name": "Sauce", "number": 3, "type": "sauce", "max_options": 2},
                {"name": "Boisson", "number": 4, "type": "boisson", "max_options": 1},
            ]
        elif instance.type == "plate":  
            default_steps = [
                {"name": "Protéine", "number": 1, "type": "accompagnement", "max_options": 1},
                {"name": "Accompagnement", "number": 2, "type": "crudité", "max_options": 2},
                {"name": "Sauce", "number": 3, "type": "sauce", "max_options": 1},
                {"name": "Boisson", "number": 4, "type": "boisson", "max_options": 1},
            ]
        elif instance.type == "dessert":
            default_steps = [
                {"name": "Dessert", "number": 1, "type": "dessert", "max_options": 1},
                {"name": "Boisson", "number": 2, "type": "boisson", "max_options": 1},
            ]
        elif instance.type == "drink":
            default_steps = [
                {"name": "Boisson", "number": 1, "type": "boisson", "max_options": 1},
                {"name": "Accompagnement", "number": 2, "type": "accompagnement", "max_options": 1},
            ]
        for step_data in default_steps:
            Step.objects.create(
                name=step_data["name"],
                number=step_data["number"],
                menu=instance,
                type=step_data["type"],
                max_options=step_data["max_options"],
            )
    #elif instance.extra == True:  # Si le menu est un menu solo
        groupMenu, _ = GroupMenu.objects.get_or_create(name=instance.type,description="Menu solo",avalaible=False, restaurant=instance.group_menu.restaurant, extra = True)
        print("restaurant",instance.group_menu.restaurant)
        print("created",_)
        Menu.objects.get_or_create(
            name=instance.name + " Solo",
            description=instance.description or "",
            price=instance.price or 0.00,  # Prix par défaut, peut être ajusté
            group_menu=groupMenu,  # Associe le menu solo au groupe de menu créé
            type=instance.type,
            photo=instance.photo or None,
            avalaible=False,  # Par défaut, les menus solo ne sont pas disponibles
            extra=True  # Indique que c'est un menu solo
        )
# Signal pour créer des StepOption lorsqu'une Option est créée
@receiver(post_save, sender=Option)
def create_step_options_for_option(sender, instance, created, **kwargs):
    if created:  # Si une nouvelle option est créée
        # Trouver toutes les étapes ayant le même type que l'option
        steps = Step.objects.filter(type=instance.type)
        for step in steps:
            StepOption.objects.create(step=step, option=instance)

# Signal pour créer des StepOption lorsqu'une Step est créée
@receiver(post_save, sender=Step)
def create_step_options_for_step(sender, instance, created, **kwargs):
    if created:  # Si une nouvelle étape est créée
        # Trouver toutes les options ayant le même type que l'étape
        options = Option.objects.filter(type=instance.type)
        for option in options:
            StepOption.objects.create(step=instance, option=option)


@receiver(post_save, sender=Option)
def create_extra_for_option(sender, instance, created, **kwargs):
    if created and instance.type in ['boisson','dessert','accompagnement']:  # Vérifie si l'option est une boisson
        groupMenu, _ = GroupMenu.objects.get_or_create(name=instance.type,description="Supplément",avalaible=False, restaurant=instance.restaurant)
        Menu.objects.get_or_create(
            name=instance.name + " Solo",
            description=instance.description or "",
            price=instance.price or 0.00,  # Prix par défaut, peut être ajusté
            group_menu=groupMenu,  # Associe le menu solo au groupe de menu créé
            type=instance.type,
            photo=instance.photo or None,
            avalaible=False,  # Par défaut, les menus solo ne sont pas disponibles
            extra=True  # Indique que c'est un menu solo
        )

# Signal pour synchroniser le champ extra_price entre Option et StepOption
@receiver(post_save, sender=Option)
def sync_extra_price_with_stepoption(sender, instance, **kwargs):
    # Trouver toutes les StepOption associées à cette Option
    step_options = StepOption.objects.filter(option=instance)
    for step_option in step_options:
        # Mettre à jour le champ extra_price dans StepOption
        step_option.extra_price = instance.extra_price or 0.00
        step_option.save()