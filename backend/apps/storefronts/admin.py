from django.contrib import admin

from .models import (
    Storefront,
    StorefrontCatalogRule,
    StorefrontDeliveryZone,
    StorefrontDomain,
    StorefrontOrder,
)


@admin.register(Storefront)
class StorefrontAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'slug', 'tenant', 'default_outlet', 'is_active')
    search_fields = ('name', 'slug', 'tenant__name')
    list_filter = ('is_active',)


@admin.register(StorefrontDomain)
class StorefrontDomainAdmin(admin.ModelAdmin):
    list_display = ('domain', 'storefront', 'is_primary', 'is_verified', 'ssl_status')
    search_fields = ('domain', 'storefront__name')
    list_filter = ('is_primary', 'is_verified')


@admin.register(StorefrontCatalogRule)
class StorefrontCatalogRuleAdmin(admin.ModelAdmin):
    list_display = ('id', 'storefront', 'rule_type', 'category', 'product')
    list_filter = ('rule_type',)


@admin.register(StorefrontDeliveryZone)
class StorefrontDeliveryZoneAdmin(admin.ModelAdmin):
    list_display = ('id', 'storefront', 'name', 'fee', 'minimum_order', 'is_active')
    list_filter = ('is_active',)


@admin.register(StorefrontOrder)
class StorefrontOrderAdmin(admin.ModelAdmin):
    list_display = ('public_order_ref', 'storefront', 'sale', 'status', 'payment_method', 'created_at')
    search_fields = ('public_order_ref', 'sale__receipt_number', 'customer_name', 'customer_phone')
    list_filter = ('status', 'payment_method', 'channel')
