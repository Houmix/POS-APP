# order/serializers.py
from rest_framework import serializers
from .models import Order, OrderItem, OrderItemOption

class OrderItemOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemOption
        fields = ['id', 'option']

class OrderItemSerializer(serializers.ModelSerializer):
    options = OrderItemOptionSerializer(many=True, read_only=True)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'menu', 'extra', 'solo', 'quantity', 'options']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = [
            'id', 
            'user', 
            'restaurant', 
            'status', 
            'created_at', 
            'cash', 
            'paid', 
            'refund', 
            'cancelled', 
            'take_away',
            'items',
            'total_price'
        ]
        # Permettre les mises à jour partielles
        extra_kwargs = {
            'user': {'required': False},
            'restaurant': {'required': False},
        }
    
    def get_total_price(self, obj):
        return obj.total_price()
    
    def update(self, instance, validated_data):
        """
        Mise à jour personnalisée pour gérer les champs booléens correctement
        """
        print(f"🔄 [SERIALIZER] Mise à jour de la commande #{instance.id}")
        print(f"   Données reçues: {validated_data}")
        
        # Mettre à jour chaque champ présent dans validated_data
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            print(f"   ✅ {attr} = {value}")
        
        instance.save()
        print(f"✅ [SERIALIZER] Commande #{instance.id} sauvegardée")
        
        return instance