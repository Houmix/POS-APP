#Utilisé pour transformer nos données sous formats JSON (Convertir des objets en JSON)

from rest_framework import serializers
from .models import Loyalty

class LoyaltySerializer(serializers.ModelSerializer):
    class Meta:
        model = Loyalty #Indiquer le model a serializer
        fields = ["id","user", "restaurant", "point"] #Indiquer les champs du modèle à serializer et donc envoyer via l'API (champs a récuperer aussi)
    #next step is to create the view for the api in view.py
