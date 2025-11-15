#Utilisé pour transformer nos données sous formats JSON (Convertir des objets en JSON)

from rest_framework import serializers
from .models import GroupMenu,Menu,Option,Step, StepOption
class GroupMenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupMenu 
        fields = ["id","name", "photo", "description", "restaurant","avalaible","photo"] 

class MenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = Menu
        fields = ["id","name", "description", "price","group_menu",'avalaible',"extra","solo_price","photo"] 

class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'name', 'type', 'avalaible',"extra_price", 'photo']

class StepOptionSerializer(serializers.ModelSerializer):
    option = OptionSerializer()
    class Meta:
        model = StepOption
        fields = ['id', 'option', 'is_default',"avalaible", 'extra_price']
        
class StepSerializer(serializers.ModelSerializer):
    stepoptions = StepOptionSerializer(many=True)  # Inclure les options

    class Meta:
        model = Step
        fields = ['id', 'name', 'number', 'type', 'max_options', 'stepoptions']

