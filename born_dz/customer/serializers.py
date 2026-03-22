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
    display_name        = serializers.SerializerMethodField()
    display_image_url   = serializers.SerializerMethodField()
    display_price       = serializers.SerializerMethodField()

    def _build_url(self, path):
        request = self.context.get('request')
        if not path:
            return None
        url = path.url if hasattr(path, 'url') else str(path)
        if url.startswith('http'):
            return url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_display_name(self, obj):
        return obj.display_name()

    def get_display_image_url(self, obj):
        if obj.reward_type == 'menu' and obj.menu:
            return self._build_url(obj.menu.photo)
        return None

    def get_display_price(self, obj):
        if obj.reward_type == 'menu' and obj.menu:
            # Retourne le prix solo ou le prix menu selon is_solo
            if obj.is_solo:
                return float(obj.menu.solo_price) if obj.menu.solo_price else float(obj.menu.price)
            return float(obj.menu.price)
        if obj.reward_type == 'option' and obj.option:
            return float(obj.option.extra_price) if hasattr(obj.option, 'extra_price') else None
        return None

    class Meta:
        model = LoyaltyReward
        fields = [
            "id", "restaurant", "reward_type",
            "menu", "option",
            "name", "description",
            "points_required", "is_active", "is_solo", "created_at",
            "display_name", "display_image_url", "display_price",
        ]
        read_only_fields = ["created_at", "display_name", "display_image_url", "display_price"]


class LoyaltyRedemptionSerializer(serializers.ModelSerializer):
    reward_name = serializers.CharField(source='reward.name', read_only=True)
    customer_identifier = serializers.CharField(source='customer_loyalty.customer_identifier', read_only=True)

    class Meta:
        model = LoyaltyRedemption
        fields = ["id", "customer_loyalty", "customer_identifier", "reward", "reward_name", "points_spent", "created_at"]
        read_only_fields = ["created_at", "points_spent"]
