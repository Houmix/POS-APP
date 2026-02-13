from django.contrib import admin
from .models import License, LicenseActivation, Terminal

@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ['key', 'restaurant', 'plan', 'status', 'active_terminals_count', 'max_terminals']
    list_filter = ['status', 'plan']
    readonly_fields = ['key']
    
    def save_model(self, request, obj, form, change):
        if not obj.key:  # Nouvelle licence → générer la clé auto
            obj.key = License.generate_key()
        super().save_model(request, obj, form, change)

@admin.register(LicenseActivation)
class LicenseActivationAdmin(admin.ModelAdmin):
    list_display = ['license', 'machine_name', 'platform', 'is_active', 'last_seen']
    list_filter = ['is_active']