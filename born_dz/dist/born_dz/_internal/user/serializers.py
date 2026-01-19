#Utilisé pour transformer nos données sous formats JSON (Convertir des objets en JSON)

from django.utils.crypto import get_random_string
from rest_framework import serializers
from .models import Employee, User, Role
from restaurant.models import Restaurant
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'role']

class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer()  # Sérialise la relation avec le modèle Role

    class Meta:
        model = User
        fields = ['id', 'phone', 'email', 'role', 'password']
        extra_kwargs = {
            'password': {'write_only': True},  # Le mot de passe sera en lecture seule
        }

    def create(self, validated_data):
        role_data = validated_data.pop('role', None)
        if role_data:
            role = Role.objects.get(role=role_data['role'])
            validated_data['role'] = role
        user = User.objects.create(**validated_data)
        return user

    def update(self, instance, validated_data):
        role_data = validated_data.pop('role', None)
        if role_data:
            role = Role.objects.get(role=role_data['role'])
            instance.role = role
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer()  # Sérialise la relation avec le modèle User
    restaurant = serializers.PrimaryKeyRelatedField(queryset=Restaurant.objects.all())

    class Meta:
        model = Employee
        fields = ['id', 'user', 'restaurant']

    def create(self, validated_data):
        user_data = validated_data.pop('user')
        user_serializer = UserSerializer(data=user_data)
        if user_serializer.is_valid():
            user = user_serializer.save()
            employee = Employee.objects.create(user=user, **validated_data)
            return employee
        else:
            raise serializers.ValidationError(user_serializer.errors)

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', None)
        if user_data:
            user_serializer = UserSerializer(instance.user, data=user_data)
            if user_serializer.is_valid():
                user_serializer.save()
            else:
                raise serializers.ValidationError(user_serializer.errors)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


