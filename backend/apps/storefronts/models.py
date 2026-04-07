from decimal import Decimal

from django.db import models

from apps.outlets.models import Outlet
from apps.products.models import Category, Product
from apps.sales.models import Sale
from apps.tenants.models import Tenant


class Storefront(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='storefronts')
    default_outlet = models.ForeignKey(Outlet, on_delete=models.PROTECT, related_name='storefronts')
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=120)
    is_active = models.BooleanField(default=True)
    whatsapp_number = models.CharField(max_length=32, blank=True)
    currency_override = models.CharField(max_length=3, blank=True)
    theme_settings = models.JSONField(default=dict, blank=True)
    checkout_settings = models.JSONField(default=dict, blank=True)
    seo_settings = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'storefronts_storefront'
        ordering = ['name']
        unique_together = [('tenant', 'slug')]
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['slug']),
        ]

    def __str__(self):
        return f"{self.tenant.name} - {self.name}"


class StorefrontDomain(models.Model):
    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='domains')
    domain = models.CharField(max_length=255, unique=True)
    is_primary = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    ssl_status = models.CharField(max_length=32, default='unknown')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'storefronts_domain'
        ordering = ['-is_primary', 'domain']
        indexes = [
            models.Index(fields=['domain']),
        ]

    def __str__(self):
        return self.domain


class StorefrontCatalogRule(models.Model):
    RULE_TYPES = [
        ('include', 'Include'),
        ('exclude', 'Exclude'),
    ]

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='catalog_rules')
    rule_type = models.CharField(max_length=10, choices=RULE_TYPES)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.CASCADE, related_name='storefront_rules')
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.CASCADE, related_name='storefront_rules')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'storefronts_catalog_rule'
        indexes = [
            models.Index(fields=['storefront', 'rule_type']),
        ]

    def __str__(self):
        target = self.product_id or self.category_id
        return f"{self.storefront_id}:{self.rule_type}:{target}"


class StorefrontDeliveryZone(models.Model):
    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='delivery_zones')
    name = models.CharField(max_length=120)
    fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    minimum_order = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'storefronts_delivery_zone'
        unique_together = [('storefront', 'name')]
        ordering = ['name']

    def __str__(self):
        return f"{self.storefront.name} - {self.name}"


class StorefrontOrder(models.Model):
    CHANNEL_CHOICES = [('whatsapp', 'WhatsApp')]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
    ]

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='orders')
    sale = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name='storefront_order')
    public_order_ref = models.CharField(max_length=32, unique=True)
    channel = models.CharField(max_length=24, choices=CHANNEL_CHOICES, default='whatsapp')
    payment_method = models.CharField(max_length=20, default='cash')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=32, blank=True)
    customer_address = models.TextField(blank=True)
    whatsapp_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'storefronts_order'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['storefront', 'status']),
            models.Index(fields=['public_order_ref']),
        ]

    def __str__(self):
        return self.public_order_ref


class StorefrontEvent(models.Model):
    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='events')
    event_name = models.CharField(max_length=64)
    session_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'storefronts_event'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['storefront', 'created_at']),
            models.Index(fields=['storefront', 'event_name']),
        ]

    def __str__(self):
        return f"{self.storefront_id}:{self.event_name}"
