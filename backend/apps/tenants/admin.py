from django.contrib import admin
from .models import Tenant, TenantPaymentRecord


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'currency', 'is_active', 'created_at')
    list_filter = ('type', 'is_active', 'created_at')
    search_fields = ('name', 'email', 'phone')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(TenantPaymentRecord)
class TenantPaymentRecordAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'amount', 'reason', 'payment_date', 'recorded_by')
    list_filter = ('payment_date', 'tenant')
    search_fields = ('tenant__name', 'reason', 'notes')
    readonly_fields = ('created_at',)

