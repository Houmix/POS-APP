from django.contrib import admin
from django.utils import timezone
from datetime import timedelta
from .models import License, LicenseActivation, Terminal


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = ['key', 'restaurant', 'plan', 'status', 'expires_at', 'days_remaining', 'active_terminals_count', 'max_terminals', 'created_at']
    list_filter = ['status', 'plan']
    search_fields = ['key', 'restaurant__name']
    readonly_fields = ['key', 'created_at', 'active_terminals_count']
    fields = ['restaurant', 'key', 'plan', 'status', 'max_terminals', 'expires_at', 'features', 'created_at', 'active_terminals_count']
    actions = ['renew_6_months', 'renew_1_year', 'renew_2_years', 'suspend', 'reactivate']

    def days_remaining(self, obj):
        if not obj.expires_at:
            return '∞'
        delta = obj.expires_at - timezone.now()
        days = delta.days
        if days < 0:
            return f'Expirée ({abs(days)}j)'
        if days <= 30:
            return f'⚠️ {days}j'
        return f'{days}j'
    days_remaining.short_description = 'Validité restante'

    def save_model(self, request, obj, form, change):
        if not obj.key:
            obj.key = License.generate_key()
        super().save_model(request, obj, form, change)

    @admin.action(description='Renouveler 6 mois')
    def renew_6_months(self, request, queryset):
        self._renew(queryset, 6)

    @admin.action(description='Renouveler 1 an')
    def renew_1_year(self, request, queryset):
        self._renew(queryset, 12)

    @admin.action(description='Renouveler 2 ans')
    def renew_2_years(self, request, queryset):
        self._renew(queryset, 24)

    @admin.action(description='Suspendre')
    def suspend(self, request, queryset):
        queryset.update(status='suspended')

    @admin.action(description='Réactiver')
    def reactivate(self, request, queryset):
        queryset.update(status='active')

    def _renew(self, queryset, months):
        now = timezone.now()
        for lic in queryset:
            base = max(now, lic.expires_at) if lic.expires_at and lic.expires_at > now else now
            lic.expires_at = base + timedelta(days=months * 30)
            lic.status = 'active'
            lic.save()


@admin.register(LicenseActivation)
class LicenseActivationAdmin(admin.ModelAdmin):
    list_display = ['license', 'machine_name', 'platform', 'is_active', 'activated_at', 'last_seen']
    list_filter = ['is_active']
    search_fields = ['machine_name', 'license__key', 'license__restaurant__name']
    readonly_fields = ['activated_at', 'last_seen']


@admin.register(Terminal)
class TerminalAdmin(admin.ModelAdmin):
    list_display = ['name', 'restaurant', 'uuid']
    search_fields = ['name', 'restaurant__name', 'uuid']