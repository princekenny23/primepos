from django.contrib import admin
from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('expense_number', 'title', 'amount', 'expense_date', 'status', 'tenant', 'outlet')
    list_filter = ('status', 'payment_method', 'expense_date', 'tenant')
    search_fields = ('expense_number', 'title', 'description', 'vendor')
    readonly_fields = ('expense_number', 'created_at', 'updated_at')
    date_hierarchy = 'expense_date'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('expense_number', 'title', 'vendor', 'description')
        }),
        ('Financial', {
            'fields': ('amount', 'payment_method', 'payment_reference', 'expense_date')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Relations', {
            'fields': ('tenant', 'outlet', 'user')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

