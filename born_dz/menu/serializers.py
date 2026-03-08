# menu/serializers.py
# Serializers CORRIGÉS avec gestion des URLs d'images

from rest_framework import serializers
from .models import GroupMenu, Menu, Option, Step, StepOption


class GroupMenuSerializer(serializers.ModelSerializer):
    """
    Serializer pour GroupMenu avec gestion correcte des fichiers et URLs
    """
    photo = serializers.FileField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = GroupMenu 
        fields = ["id", "name", "photo", "photo_url", "description", "restaurant", 
                  "avalaible", "extra", "position"]
    
    def get_photo_url(self, obj):
        """
        Retourne l'URL complète de la photo
        """
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None
    
    def update(self, instance, validated_data):
        """
        Override update pour gérer correctement les fichiers
        Si 'photo' n'est pas dans validated_data, on ne touche pas au fichier existant
        """
        if 'photo' not in validated_data or validated_data.get('photo') is None:
            validated_data.pop('photo', None)
        return super().update(instance, validated_data)


class MenuSerializer(serializers.ModelSerializer):
    """
    Serializer pour Menu avec gestion correcte des fichiers et URLs
    """
    photo = serializers.FileField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()
    group_menu_name = serializers.CharField(source='group_menu.name', read_only=True)
    
    class Meta:
        model = Menu
        fields = [
            "id", "name", "description", "price", "group_menu", "group_menu_name",
            "avalaible", "extra", "solo_price", "photo", "photo_url", "type", "position",
            "show_in_crosssell"
        ]
    
    def get_photo_url(self, obj):
        """
        Retourne l'URL complète de la photo
        """
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None
    
    def update(self, instance, validated_data):
        """
        Override update pour gérer correctement les fichiers
        """
        if 'photo' not in validated_data or validated_data.get('photo') is None:
            validated_data.pop('photo', None)
        return super().update(instance, validated_data)


class OptionSerializer(serializers.ModelSerializer):
    """
    Serializer pour Option avec gestion correcte des fichiers et URLs
    """
    photo = serializers.FileField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Option
        fields = ['id', 'name', 'type', 'avalaible', "extra_price", 'photo', 'photo_url']
    
    def get_photo_url(self, obj):
        """
        Retourne l'URL complète de la photo
        """
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None
    
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
        fields = ['id', 'name', 'number', 'type', 'max_options', 'stepoptions', 'avalaible', 'show_for_solo', 'show_for_full']