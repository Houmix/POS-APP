# restaurant/serializers.py
from rest_framework import serializers
from .models import Restaurant, KioskConfig
from chain.models import Chain


class ChainSerializer(serializers.ModelSerializer):
    """Serializer pour afficher les informations de la chaîne"""
    class Meta:
        model = Chain
        fields = ['id', 'name']  # Ajoutez d'autres champs selon votre modèle Chain


class RestaurantSerializer(serializers.ModelSerializer):
    """Serializer complet pour le restaurant"""
    chain_name = serializers.CharField(source='chain.name', read_only=True)
    chain_details = ChainSerializer(source='chain', read_only=True)
    logo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Restaurant
        fields = [
            'id',
            'name',
            'address',
            'phone',
            'immat',
            'logo',
            'logo_url',
            'chain',
            'chain_name',
            'chain_details',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_logo_url(self, obj):
        """Retourne l'URL complète du logo si disponible"""
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None


class KioskConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = KioskConfig
        fields = [
            'primary_color', 'secondary_color',
            'background_color', 'card_bg_color', 'text_color',
            'sidebar_color', 'category_bg_color', 'selected_category_bg_color', 'category_text_color',
            'logo', 'screensaver_image', 'screensaver_video', 'card_style',
        ]


class RestaurantCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer pour la création et mise à jour (sans champs read-only)"""
    class Meta:
        model = Restaurant
        fields = [
            'id',
            'name',
            'address',
            'phone',
            'immat',
            'logo',
            'chain'
        ]
        read_only_fields = ['id']