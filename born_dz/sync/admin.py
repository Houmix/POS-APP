# sync/admin.py

from django.contrib import admin
from .models import SyncLog


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'restaurant', 'table_name', 'action', 'record_id', 'source', 'terminal_uuid']
    list_filter = ['restaurant', 'table_name', 'action', 'source']
    search_fields = ['table_name', 'record_id']
    readonly_fields = ['created_at', 'data']
    ordering = ['-created_at']
    
    def has_add_permission(self, request):
        return False  # Les logs sont créés automatiquement