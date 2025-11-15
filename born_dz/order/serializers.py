#Utilisé pour transformer nos données sous formats JSON (Convertir des objets en JSON)

from rest_framework import serializers
from .models import OrderItem, Order, OrderItemOption


class OrderItemOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemOption
        fields = ['option']

class OrderItemSerializer(serializers.ModelSerializer):
    options = OrderItemOptionSerializer(many=True)

    class Meta:
        model = OrderItem
        fields = ['menu', 'quantity', 'options', 'extra',"solo"]

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ['id', 'user', 'status', 'created_at', 'cash','paid','refund','items', 'cancelled', 'take_away']
