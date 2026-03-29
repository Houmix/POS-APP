from django.contrib import admin
from .models import (
    StockCategory, StockItem, MenuStockLink, OptionStockLink,
    StockMovement, StockAlert,
)


class MenuStockLinkInline(admin.TabularInline):
    model = MenuStockLink
    extra = 1
    raw_id_fields = ['menu']


class OptionStockLinkInline(admin.TabularInline):
    model = OptionStockLink
    extra = 1
    raw_id_fields = ['option']


@admin.register(StockCategory)
class StockCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'restaurant', 'position']
    list_filter = ['restaurant']
    ordering = ['position', 'name']


@admin.register(StockItem)
class StockItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'quantity', 'unit', 'status', 'category',
                    'min_threshold', 'critical_threshold', 'supplier', 'restaurant']
    list_filter = ['restaurant', 'category', 'unit', 'is_active']
    search_fields = ['name', 'sku', 'supplier']
    inlines = [MenuStockLinkInline, OptionStockLinkInline]
    readonly_fields = ['version', 'updated_at', 'created_at']

    def status(self, obj):
        return obj.status
    status.short_description = 'Statut'


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'stock_item', 'movement_type', 'quantity',
                    'quantity_before', 'quantity_after', 'reason']
    list_filter = ['movement_type', 'stock_item__restaurant']
    date_hierarchy = 'created_at'
    readonly_fields = ['stock_item', 'movement_type', 'quantity',
                       'quantity_before', 'quantity_after', 'order_id', 'created_at']


@admin.register(StockAlert)
class StockAlertAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'stock_item', 'level', 'current_quantity',
                    'threshold', 'is_resolved']
    list_filter = ['level', 'is_resolved', 'stock_item__restaurant']
    date_hierarchy = 'created_at'
