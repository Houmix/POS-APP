# menu/serializers.py

from rest_framework import serializers
from .models import GroupMenu, Menu, Option, Step, MenuStep, StepOption


def _cache_bust(url, obj):
    """Ajoute ?v=<timestamp> pour invalider le cache image quand l'objet change."""
    if not url:
        return url
    updated = getattr(obj, 'updated_at', None)
    if updated and '?v=' not in url:
        try:
            return f"{url}?v={int(updated.timestamp())}"
        except Exception:
            pass
    return url


def _resolve_photo_url(obj, request):
    """
    Résout l'URL de la photo d'un objet Menu/GroupMenu/Option.
    Gère 3 cas :
      1. Chemin relatif local → build_absolute_uri (URL locale)
      2. URL cloud, mais fichier existe localement → URL locale
      3. URL cloud, fichier absent localement → URL cloud (fallback)
    """
    import os
    from django.conf import settings as _settings

    if not obj.photo:
        return None

    photo_name = str(obj.photo)

    # Cas 1 : chemin relatif local
    if not photo_name.startswith('http://') and not photo_name.startswith('https://'):
        if request:
            return _cache_bust(request.build_absolute_uri(obj.photo.url), obj)
        return _cache_bust(obj.photo.url, obj)

    # Cas 2 & 3 : URL distante — vérifier si le fichier existe localement
    # Extraire le chemin relatif depuis l'URL cloud (ex: .../media/restaurant/menu/burger.jpg → restaurant/menu/burger.jpg)
    clean_url = photo_name.split('?')[0]  # retirer ?v=xxx
    if '/media/' in clean_url:
        relative = clean_url.split('/media/')[-1]
        local_path = os.path.join(_settings.MEDIA_ROOT, relative)
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            # Fichier disponible localement → servir en local
            local_url = f"{_settings.MEDIA_URL}{relative}"
            if request:
                return _cache_bust(request.build_absolute_uri(local_url), obj)
            return _cache_bust(local_url, obj)

    # Fallback : URL cloud (si la borne a internet, ça marchera)
    return _cache_bust(photo_name, obj)


class GroupMenuSerializer(serializers.ModelSerializer):
    photo = serializers.FileField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = GroupMenu
        fields = ["id", "name", "photo", "photo_url", "description", "restaurant",
                  "avalaible", "extra", "position"]

    def get_photo_url(self, obj):
        return _resolve_photo_url(obj, self.context.get('request'))

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
            "id", "name", "description", "price", "promo_price", "promo_percentage",
            "promo_display", "group_menu", "group_menu_name",
            "avalaible", "extra", "solo_price", "photo", "photo_url", "type", "position",
            "show_in_crosssell", "offer_menu_choice", "skip_kds"
        ]

    def get_photo_url(self, obj):
        return _resolve_photo_url(obj, self.context.get('request'))

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
        return _resolve_photo_url(obj, self.context.get('request'))

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
