#Utilisé pour transformer nos données sous formats JSON (Convertir des objets en JSON)

from rest_framework import serializers
from .models import Loyalty, CustomerLoyalty, LoyaltyReward, LoyaltyRedemption

class LoyaltySerializer(serializers.ModelSerializer):
    class Meta:
        model = Loyalty
        fields = ["id", "user", "restaurant", "point"]


class CustomerLoyaltySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerLoyalty
        fields = ["id", "customer_identifier", "restaurant", "points", "total_spent", "visit_count", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class LoyaltyRewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyReward
        fields = ["id", "restaurant", "name", "description", "points_required", "is_active", "created_at"]
        read_only_fields = ["created_at"]


class LoyaltyRedemptionSerializer(serializers.ModelSerializer):
    reward_name = serializers.CharField(source='reward.name', read_only=True)
    customer_identifier = serializers.CharField(source='customer_loyalty.customer_identifier', read_only=True)

    class Meta:
        model = LoyaltyRedemption
        fields = ["id", "customer_loyalty", "customer_identifier", "reward", "reward_name", "points_spent", "created_at"]
        read_only_fields = ["created_at", "points_spent"]
