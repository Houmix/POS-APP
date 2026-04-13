from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from restaurant.models import Restaurant
from django.conf import settings
from django.contrib.auth.hashers import make_password, is_password_usable


class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError("Le numéro de téléphone est obligatoire")
        extra_fields.setdefault('is_active', True)
        user = self.model(phone=phone, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(phone, password, **extra_fields)


class Role(models.Model):
    ROLE_CHOICES = [
        ('customer', 'Customer'),
        ('manager', 'Manager'),
        ('cashier', 'Cashier'),
        ('owner', 'Owner')
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    
    def __str__(self):
        return str(self.id) + " " + self.role


class User(AbstractUser):
    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = []

    objects = UserManager()

    username = models.CharField(max_length=150, blank=True, null=True, unique=False)
    
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    phone = models.CharField(max_length=10, unique=True)
    email = models.EmailField(unique=True, blank=True, null=True)
    
    # ❌ SUPPRIMÉ : password = models.CharField(...) 
    # AbstractUser possède déjà ce champ, le redéfinir ici cassait le hachage.

    def save(self, *args, **kwargs):
            if not self.username:
                self.username = self.phone
            if not self.email:
                self.email = f"{self.phone}@born.dz"
     
            # Vérification de la longueur avant le hachage
            if self.password and not (self.password.startswith('pbkdf2_') or self.password.startswith('bcrypt')):
                if len(self.password) != 6:
                    raise ValueError("Le mot de passe doit faire exactement 6 caractères.")
                self.set_password(self.password)
                
            super().save(*args, **kwargs)


class Employee(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    restaurant = models.ForeignKey(Restaurant, on_delete=models.SET_NULL, null=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    contract_type = models.CharField(
        max_length=10,
        choices=[('CDI', 'CDI'), ('CDD', 'CDD'), ('MI-TEMPS', 'Mi-temps'), ('STAGE', 'Stage')],
        blank=True
    )
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    monthly_hours = models.IntegerField(null=True, blank=True)
    national_id = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)

    def __str__(self):
        phone = self.user.phone if self.user else "N/A"
        role = self.user.role.role if self.user and self.user.role else "N/A"
        restaurant_name = self.restaurant.name if self.restaurant else "N/A"
        return f"{phone} {role} {restaurant_name}"


class CashierSession(models.Model):
    """Suivi automatique de l'activité des caissiers sur le POS."""
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='cashier_sessions')
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, null=True)
    login_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now_add=True)
    logout_at = models.DateTimeField(null=True, blank=True)
    logout_reason = models.CharField(max_length=20, choices=[
        ('manual', 'Déconnexion manuelle'),
        ('timeout', 'Inactivité (timeout)'),
        ('forced', 'Déconnexion forcée'),
    ], default='manual')

    @property
    def active_duration_minutes(self):
        end = self.logout_at or self.last_activity
        return int((end - self.login_at).total_seconds() / 60)

    class Meta:
        ordering = ['-login_at']
        indexes = [
            models.Index(fields=['employee', 'login_at']),
            models.Index(fields=['restaurant', 'login_at']),
        ]

    def __str__(self):
        return f"{self.employee} - {self.login_at.strftime('%d/%m %H:%M')}"


class TimeEntry(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='time_entries')
    check_in = models.DateTimeField()
    check_out = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    @property
    def total_hours(self):
        if self.check_out:
            return (self.check_out - self.check_in).seconds / 3600
        return None

    def __str__(self):
        return f"{self.employee} - {self.check_in}"


class WorkSchedule(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='schedules')
    week_start = models.DateField()
    day_of_week = models.IntegerField()  # 0=Lundi, 6=Dimanche
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.employee} - Jour {self.day_of_week}"


class Payslip(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payslips')
    period_start = models.DateField()
    period_end = models.DateField()
    hours_worked = models.DecimalField(max_digits=6, decimal_places=2)
    gross_salary = models.DecimalField(max_digits=10, decimal_places=2)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.employee} - {self.period_start}"


class EmployeeDocument(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=200)
    doc_type = models.CharField(max_length=20, choices=[
        ('contract', 'Contrat'),
        ('id_card', 'CIN'),
        ('certificate', 'Attestation'),
        ('amendment', 'Avenant'),
        ('other', 'Autre'),
    ])
    file = models.FileField(upload_to='employee_docs/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.employee} - {self.title}"