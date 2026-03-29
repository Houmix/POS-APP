from django.contrib import admin
from .models import AuditLog, SyncMetrics


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'action', 'severity', 'table_name',
                    'record_name', 'user_phone', 'ip_address', 'restaurant_id']
    list_filter = ['action', 'severity', 'table_name', 'restaurant_id']
    search_fields = ['description', 'user_phone', 'record_name']
    readonly_fields = ['created_at', 'action', 'severity', 'table_name',
                       'record_id', 'record_name', 'description', 'changes',
                       'user', 'user_phone', 'user_role', 'ip_address',
                       'restaurant_id', 'extra_data']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False  # Audit logs are immutable

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SyncMetrics)
class SyncMetricsAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'sync_type', 'restaurant_id',
                    'records_count', 'duration_ms', 'success']
    list_filter = ['sync_type', 'success', 'restaurant_id']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
