from rest_framework import serializers
from .models import Employee, User, Role, TimeEntry, WorkSchedule, Payslip, EmployeeDocument
from restaurant.models import Restaurant

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'role']

class UserSerializer(serializers.ModelSerializer):
    # 1. MODIFICATION CRITIQUE : On accepte l'ID du rôle (ex: 2) pour l'écriture
    # queryset=Role.objects.all() permet de vérifier que l'ID existe en base
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all())
    role_name = serializers.CharField(source='role.role', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'phone', 'email', 'role', 'role_name', 'password']
        extra_kwargs = {
            'password': {
                'write_only': True,
                'min_length': 6, # Sécurité minimale DRF
                'max_length': 6  # Sécurité maximale DRF
            },
            # 2. MODIFICATION : On rend ces champs optionnels pour laisser 
            # le models.py les générer automatiquement (save method)
            'email': {'required': False},
            'username': {'required': False},
        }
    
    # Cette méthode est appelée automatiquement par DRF lors du .is_valid()
    def validate_password(self, value):
        if len(value) != 6:
            raise serializers.ValidationError("Le code doit contenir exactement 6 chiffres.")
        if not value.isdigit():
            raise serializers.ValidationError("Le code doit contenir uniquement des chiffres.")
        return value

    def create(self, validated_data):
        # On extrait le mot de passe pour le traiter proprement
        password = validated_data.pop('password', None)
        
        # On crée l'instance SANS la sauvegarder tout de suite en base
        instance = self.Meta.model(**validated_data)
        
        # On définit le mot de passe (si fourni)
        if password:
            instance.set_password(password)
        
        # 3. L'appel à save() ici va déclencher la logique de votre models.py
        # (génération auto de l'email et du username si manquants)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        # Gestion du mot de passe en cas de mise à jour
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
            
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    restaurant = serializers.PrimaryKeyRelatedField(queryset=Restaurant.objects.all())

    class Meta:
        model = Employee
        fields = [
            'id', 'user', 'restaurant',
            'first_name', 'last_name', 'hire_date', 'contract_type',
            'hourly_rate', 'monthly_hours', 'national_id', 'address',
        ]

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
            user_serializer = UserSerializer(instance.user, data=user_data, partial=True)
            if user_serializer.is_valid():
                user_serializer.save()
            else:
                raise serializers.ValidationError(user_serializer.errors)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class TimeEntrySerializer(serializers.ModelSerializer):
    total_hours = serializers.ReadOnlyField()

    class Meta:
        model = TimeEntry
        fields = ['id', 'employee', 'check_in', 'check_out', 'notes', 'total_hours']
        read_only_fields = ['employee']


class WorkScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkSchedule
        fields = ['id', 'employee', 'week_start', 'day_of_week', 'start_time', 'end_time']
        read_only_fields = ['employee']


class PayslipSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payslip
        fields = [
            'id', 'employee', 'period_start', 'period_end',
            'hours_worked', 'gross_salary', 'deductions', 'net_salary',
            'notes', 'created_at',
        ]
        read_only_fields = ['employee', 'created_at']


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = ['id', 'employee', 'title', 'doc_type', 'file', 'uploaded_at', 'expiry_date']
        read_only_fields = ['employee', 'uploaded_at']