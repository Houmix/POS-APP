from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Step, Option, StepOption

# Les signaux d'auto-création par type ont été supprimés.
# Les StepOptions sont maintenant créés manuellement par le restaurateur
# via l'onglet "Étapes" du site admin.
