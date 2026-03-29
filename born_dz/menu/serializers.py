# menu/serializers.py

from rest_framework import serializers
from .models import GroupMenu, Menu, Option, Step, MenuStep, StepOption


class GroupMenuSerializer(serializers.ModelSerializer):
    photo = serializers.FileField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = GroupMenu
        fields = ["id", "name", "photo", "photo_url", "description", "restaurant",
                  "avalaible", "extra", "position"]

    def get_photo_url(self, obj):
        if obj.photo:
            photo_name = str(obj.photo)
            if photo_name.startswith('http://') or photo_name.startswith('https://'):
                return photo_name
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def update(self, instance, validated_data):
        if 'photo' not in validated_data or validated_data.get('photo') is None:
            validated_data.pop('photo', None)
        return super().update(instance, validated_data)


class MenuSerializer(serializers.ModelSerializer):
    photo = serializers.FileField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()
    group_menu_name = serializers.CharField(source='group_menu.name', read_only=True)

    class Meta:
        model = Menu
        fields = [
            "id", "name", "description", "price", "promo_price", "group_menu", "group_menu_name",
            "avalaible", "extra", "solo_price", "photo", "photo_url", "type", "position",
            "show_in_crosssell", "offer_menu_choice"
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            photo_name = str(obj.photo)
            if photo_name.startswith('http://') or photo_name.startswith('https://'):
                return photo_name
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def update(self, instance, validated_data):
        if 'photo' not in validated_data or validated_data.get('photo') is None:
            validated_data.pop('photo', None)
        return super().update(instance, validated_data)


class OptionSerializer(serializers.ModelSerializer):
    photo = serializers.FileField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Option
        fields = ['id', 'name', 'type', 'avalaible', "extra_price", 'photo', 'photo_url']

    def get_photo_url(self, obj):
        if obj.photo:
            photo_name = str(obj.photo)
            if photo_name.startswith('http://') or photo_name.startswith('https://'):
                return photo_name
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def update(self, instance, validated_data):
        if 'photo' not in validated_data or validated_data.get('photo') is None:
            validated_data.pop('photo', None)
        return super().update(instance, validated_data)


class StepOptionSerializer(serializers.ModelSerializer):
    option = OptionSerializer(read_only=True)

    class Meta:
        model = StepOption
        fields = ['id', 'option', 'is_default', 'avalaible', 'extra_price']


class StepSerializer(serializers.ModelSerializer):
    """Étape restaurant-level avec ses options."""
    stepoptions = StepOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Step
        fields = ['id', 'name', 'max_options', 'avalaible', 'stepoptions']


class MenuStepSerializer(serializers.ModelSerializer):
    """
    Lien Menu ↔ Step avec ordre et visibilité.
    Retourne les données de step (id, name, max_options, stepoptions) + les champs MenuStep.
    Compatible avec l'ancien format attendu par les apps mobiles.
    """
    # Champs repris de la Step
    step_id = serializers.IntegerField(source='step.id', read_only=True)
    name = serializers.CharField(source='step.name', read_only=True)
    max_options = serializers.IntegerField(source='step.max_options', read_only=True)
    avalaible = serializers.BooleanField(source='step.avalaible', read_only=True)
    stepoptions = serializers.SerializerMethodField()

    class Meta:
        model = MenuStep
        fields = [
            'id',           # id du MenuStep
            'step_id',      # id de la Step
            'name',
            'number',
            'max_options',
            'avalaible',
            'show_for_solo',
            'show_for_full',
            'stepoptions',
        ]

    def get_stepoptions(self, obj):
        admin = self.context.get('admin', False)
        qs = obj.step.stepoptions.select_related('option')
        if not admin:
            qs = qs.filter(avalaible=True)
        return StepOptionSerializer(qs, many=True, context=self.context).data
