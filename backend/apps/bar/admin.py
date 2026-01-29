from django.contrib import admin
from .models import BarTable, Tab, TabItem, TabTransfer, TabMerge


@admin.register(BarTable)
class BarTableAdmin(admin.ModelAdmin):
    list_display = ['number', 'table_type', 'status', 'capacity', 'outlet', 'tenant']
    list_filter = ['status', 'table_type', 'tenant', 'outlet']
    search_fields = ['number', 'location']
    ordering = ['tenant', 'outlet', 'number']


class TabItemInline(admin.TabularInline):
    model = TabItem
    extra = 0
    readonly_fields = ['added_by', 'added_at', 'total']


@admin.register(Tab)
class TabAdmin(admin.ModelAdmin):
    list_display = ['tab_number', 'customer_name', 'status', 'total', 'table', 'opened_by', 'opened_at']
    list_filter = ['status', 'tenant', 'outlet', 'opened_at']
    search_fields = ['tab_number', 'customer_name', 'customer__name']
    ordering = ['-opened_at']
    inlines = [TabItemInline]
    readonly_fields = ['tab_number', 'subtotal', 'total', 'opened_at', 'closed_at']


@admin.register(TabItem)
class TabItemAdmin(admin.ModelAdmin):
    list_display = ['tab', 'product', 'quantity', 'price', 'total', 'added_by', 'is_voided']
    list_filter = ['is_voided', 'added_at']
    search_fields = ['tab__tab_number', 'product__name']


@admin.register(TabTransfer)
class TabTransferAdmin(admin.ModelAdmin):
    list_display = ['tab', 'from_table', 'to_table', 'transferred_by', 'transferred_at']
    list_filter = ['transferred_at']
    ordering = ['-transferred_at']


@admin.register(TabMerge)
class TabMergeAdmin(admin.ModelAdmin):
    list_display = ['source_tab', 'target_tab', 'source_total', 'merged_by', 'merged_at']
    list_filter = ['merged_at']
    ordering = ['-merged_at']
