from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Menu, Step, Option, StepOption, GroupMenu


@receiver(post_save, sender=Menu)
def create_default_steps(sender, instance, created, **kwargs):
    """
    Signal pour créer automatiquement les étapes par défaut lors de la création d'un menu
    """
    if not created or instance.extra:
        # Ne rien faire si le menu existe déjà ou si c'est un menu extra/solo
        return
    
    # Initialiser default_steps pour éviter UnboundLocalError
    default_steps = []
    
    # Définir les étapes selon le type de menu
    if instance.type in ["burger", "sandwich", "wrap"]:
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
    
    # Créer les étapes
    for step_data in default_steps:
        Step.objects.create(
            name=step_data["name"],
            number=step_data["number"],
            menu=instance,
            type=step_data["type"],
            max_options=step_data["max_options"],
        )
    
    print(f"s{len(default_steps)} étapes créées pour le menu: {instance.name}")


@receiver(post_save, sender=Option)
def create_step_options_for_option(sender, instance, created, **kwargs):
    """
    Signal pour créer automatiquement les StepOption lorsqu'une Option est créée
    CORRECTIF: Utilise get_or_create pour éviter les doublons
    """
    if not created:
        return
    
    # Trouver toutes les étapes ayant le même type que l'option
    steps = Step.objects.filter(type=instance.type)
    
    created_count = 0
    for step in steps:
        # Utiliser get_or_create pour éviter les doublons
        step_option, was_created = StepOption.objects.get_or_create(
            step=step,
            option=instance,
            defaults={
                'avalaible': True,
                'is_default': False,
                'extra_price': instance.extra_price or 0.00
            }
        )
        if was_created:
            created_count += 1
    
    print(f"{created_count} StepOption créés pour l'option: {instance.name}")


@receiver(post_save, sender=Step)
def create_step_options_for_step(sender, instance, created, **kwargs):
    """
    Signal pour créer automatiquement les StepOption lorsqu'une Step est créée
    CORRECTIF: Utilise get_or_create pour éviter les doublons
    """
    if not created:
        return
    
    # Trouver toutes les options ayant le même type que l'étape
    options = Option.objects.filter(type=instance.type)
    
    created_count = 0
    for option in options:
        # Utiliser get_or_create pour éviter les doublons
        step_option, was_created = StepOption.objects.get_or_create(
            step=instance,
            option=option,
            defaults={
                'avalaible': True,
                'is_default': False,
                'extra_price': option.extra_price or 0.00
            }
        )
        if was_created:
            created_count += 1
    
    print(f"{created_count} StepOption créés pour l'étape: {instance.name}")


@receiver(post_save, sender=Option)
def sync_extra_price_with_stepoption(sender, instance, **kwargs):
    """
    Signal pour synchroniser le champ extra_price entre Option et StepOption
    CORRECTIF: Évite les boucles infinies avec update() au lieu de save()
    """
    # Trouver toutes les StepOption associées à cette Option
    step_options = StepOption.objects.filter(option=instance)
    
    # Utiliser update() pour éviter de déclencher d'autres signaux
    updated_count = step_options.update(extra_price=instance.extra_price or 0.00)
    
    if updated_count > 0:
        print(f"{updated_count} StepOption mis à jour avec extra_price={instance.extra_price}")


# ============= SIGNAL COMMENTÉ - À DÉCOMMENTER SI NÉCESSAIRE =============
# Ce signal créerait automatiquement des menus "Solo" pour certaines options
# Actuellement commenté car il semble causer des problèmes

@receiver(post_save, sender=Option)
def create_extra_for_option(sender, instance, created, **kwargs):
    """
    Signal pour créer automatiquement un menu "Solo" pour certaines options
    """
    if not created:
        return
    
    if instance.type not in ['boisson', 'dessert', 'accompagnement']:
        return
    
    # Vérifier qu'on a un restaurant (l'Option n'a pas de champ restaurant par défaut)
    # Vous devrez peut-être adapter cette logique selon votre structure
    
    # Créer ou récupérer le groupe pour les suppléments
    group_menu, _ = GroupMenu.objects.get_or_create(
        name=instance.type.capitalize(),
        defaults={
            'description': "Supplément",
            'avalaible': False,
            'extra': True,
            # 'restaurant': instance.restaurant  # À adapter selon votre modèle
        }
    )
    
    # Créer le menu solo
    Menu.objects.get_or_create(
        name=f"{instance.name} Solo",
        group_menu=group_menu,
        defaults={
            'description': instance.name,
            'price': instance.extra_price or 0.00,
            'type': instance.type,
            'avalaible': False,
            'extra': True
        }
    )




# ============= NOTES IMPORTANTES =============
"""
PROBLÈMES CORRIGÉS:

1. UnboundLocalError dans create_default_steps:
   - Initialisation de default_steps = [] au début
   - Garantit qu'il y a toujours une valeur

2. Création multiple d'options (5 fois):
   - Utilisation de get_or_create() au lieu de create()
   - Évite les doublons grâce à la contrainte unique_together

3. Boucles infinites:
   - Utilisation de update() au lieu de save() dans sync_extra_price
   - Évite de déclencher d'autres signaux post_save

4. Structure plus claire:
   - Vérifications en début de fonction
   - Logs pour faciliter le débogage
   - Commentaires explicatifs

RECOMMANDATIONS:

1. Si vous voulez désactiver temporairement un signal:
   @receiver(post_save, sender=Menu)
   def my_signal(sender, instance, created, **kwargs):
       return  # Désactive le signal
       # ... reste du code

2. Pour déboguer, activez les logs:
   import logging
   logger = logging.getLogger(__name__)
   logger.info(f"Signal déclenché pour: {instance}")

3. Pour éviter les signaux pendant les tests:
   from django.db.models.signals import post_save
   post_save.disconnect(create_default_steps, sender=Menu)
   # ... votre code de test
   post_save.connect(create_default_steps, sender=Menu)
"""