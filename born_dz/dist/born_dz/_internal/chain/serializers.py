#Utilisé pour transformer nos données sous formats JSON (Convertir des objets en JSON)

from rest_framework import serializers
from .models import Chain
class ChainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chain 
        fields = ["id","name"] 