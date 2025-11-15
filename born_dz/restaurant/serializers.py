#Utilisé pour transformer nos données sous formats JSON (Convertir des objets en JSON)

from rest_framework import serializers
from .models import Restaurant

class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant #Indiquer le model a serializer
        fields = ["id","name","address","phone","immat"] #Indiquer les champs du modèle à serializer et donc envoyer via l'API (champs a récuperer aussi)
    #next step is to create the view for the api in view.py