# menu/serializers.py
# Serializers avec gestion correcte des fichiers pour les mises à jour

from rest_framework import serializers
from .models import GroupMenu, Menu, Option, Step, StepOption


class GroupMenuSerializer(serializers.ModelSerializer):
    """
    Serializer pour GroupMenu avec gestion correcte des fichiers
    """
    # photo est optionnel et peut être exclu lors des updates
    photo = serializers.FileField(required=False, allow_null=True)
    
    class Meta:
        model = GroupMenu 
        fields = ["id", "name", "photo", "description", "restaurant", "avalaible", "extra", "position"]
    
    def update(self, instance, validated_data):
        """
        Override update pour gérer correctement les fichiers
        Si 'photo' n'est pas dans validated_data, on ne touche pas au fichier existant
        """
        # Si photo n'est pas fourni ou est None, on le retire pour garder l'ancien
        if 'photo' not in validated_data or validated_data.get('photo') is None:
            validated_data.pop('photo', None)
        
        return super().update(instance, validated_data)


class MenuSerializer(serializers.ModelSerializer):
    """
    Serializer pour Menu avec gestion correcte des fichiers
    """
    photo = serializers.FileField(required=False, allow_null=True)
    group_menu_name = serializers.CharField(source='group_menu.name', read_only=True)
    
    class Meta:
        model = Menu
        fields = [
            "id", "name", "description", "price", "group_menu", "group_menu_name",
            "avalaible", "extra", "solo_price", "photo", "type", "position"
        ]
    
    def update(self, instance, validated_data):
        """
        Override update pour gérer correctement les fichiers
        """
        if 'photo' not in validated_data or validated_data.get('photo') is None:
            validated_data.pop('photo', None)
        
        return super().update(instance, validated_data)


class OptionSerializer(serializers.ModelSerializer):
    """
    Serializer pour Option avec gestion correcte des fichiers
    """
    photo = serializers.FileField(required=False, allow_null=True)
    
    class Meta:
        model = Option
        fields = ['id', 'name', 'type', 'avalaible', "extra_price", 'photo']
    
    def update(self, instance, validated_data):
        """
        Override update pour gérer correctement les fichiers
        """
        if 'photo' not in validated_data or validated_data.get('photo') is None:
            validated_data.pop('photo', None)
        
        return super().update(instance, validated_data)


class StepOptionSerializer(serializers.ModelSerializer):
    option = OptionSerializer(read_only=True)
    
    class Meta:
        model = StepOption
        fields = ['id', 'option', 'is_default', "avalaible", 'extra_price']


class StepSerializer(serializers.ModelSerializer):
    stepoptions = StepOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Step
        fields = ['id', 'name', 'number', 'type', 'max_options', 'stepoptions', 'avalaible']