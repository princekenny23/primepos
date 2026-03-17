from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from decimal import Decimal


class Tenant(models.Model):
    """Multi-tenant Business model"""
    BUSINESS_TYPES = [
        ('retail', 'Wholesale and Retail'),
        ('restaurant', 'Restaurant'),
        ('bar', 'Bar'),
    ]

    POS_TYPES = [
        ('standard', 'Standard POS'),
        ('single_product', 'Single-Product POS'),
    ]

    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=BUSINESS_TYPES, default='retail')
    pos_type = models.CharField(max_length=20, choices=POS_TYPES, default='standard')
    currency = models.CharField(max_length=3, default='MWK')
    currency_symbol = models.CharField(max_length=10, default='MWK')  # MWK symbol
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    logo = models.ImageField(upload_to='tenants/logos/', blank=True, null=True, help_text='Business logo')
    settings = models.JSONField(default=dict, blank=True)
    has_distribution = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenants_tenant'
        verbose_name = 'Tenant'
        verbose_name_plural = 'Tenants'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class TenantPaymentRecord(models.Model):
    """Manual subscription payment records for tenants."""
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='payment_records'
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    reason = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    payment_date = models.DateTimeField(default=timezone.now)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tenant_payment_records'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tenant_payment_records'
        verbose_name = 'Tenant Payment Record'
        verbose_name_plural = 'Tenant Payment Records'
        ordering = ['-payment_date', '-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['payment_date']),
        ]

    def __str__(self):
        return f"{self.tenant.name} - {self.amount} on {self.payment_date.date()}"


# Signal to create default roles when a tenant is created
@receiver(post_save, sender=Tenant)
def create_default_tenant_roles(sender, instance, created, **kwargs):
    """Automatically create default roles for a new tenant"""
    if created:
        from apps.accounts.models import create_default_roles_for_tenant
        try:
            create_default_roles_for_tenant(instance)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to create default roles for tenant {instance.id}: {str(e)}")


class TenantPermissions(models.Model):
    """
    Granular permissions for tenant apps and features.
    SaaS admin can enable/disable entire apps or specific features.
    """
    tenant = models.OneToOneField(
        Tenant,
        on_delete=models.CASCADE,
        related_name='permissions',
        help_text='Related tenant'
    )
    
    # App-level permissions
    allow_sales = models.BooleanField(default=True, help_text='Enable Sales app')
    allow_pos = models.BooleanField(default=True, help_text='Enable POS app')
    allow_inventory = models.BooleanField(default=True, help_text='Enable Inventory app')
    allow_office = models.BooleanField(default=True, help_text='Enable Office app')
    allow_settings = models.BooleanField(default=True, help_text='Enable Settings app')
    
    # Sales features
    allow_sales_create = models.BooleanField(default=True, help_text='Create new sales')
    allow_sales_refund = models.BooleanField(default=True, help_text='Process refunds')
    allow_sales_reports = models.BooleanField(default=True, help_text='View sales reports')
    
    # POS features
    allow_pos_restaurant = models.BooleanField(default=True, help_text='Restaurant POS mode')
    allow_pos_bar = models.BooleanField(default=True, help_text='Bar POS mode')
    allow_pos_retail = models.BooleanField(default=True, help_text='Retail POS mode')
    allow_pos_discounts = models.BooleanField(default=True, help_text='Apply discounts in POS')
    
    # Inventory features
    allow_inventory_products = models.BooleanField(default=True, help_text='Manage products')
    allow_inventory_stock_take = models.BooleanField(default=True, help_text='Perform stock take')
    allow_inventory_transfers = models.BooleanField(default=True, help_text='Stock transfers between outlets')
    allow_inventory_adjustments = models.BooleanField(default=True, help_text='Stock adjustments')
    allow_inventory_suppliers = models.BooleanField(default=True, help_text='Manage suppliers')
    
    # Office features
    allow_office_accounting = models.BooleanField(default=True, help_text='Accounting module')
    allow_office_hr = models.BooleanField(default=True, help_text='HR & Payroll module')
    allow_office_reports = models.BooleanField(default=True, help_text='Office reports')
    allow_office_analytics = models.BooleanField(default=True, help_text='Analytics dashboard')
    
    # Settings features
    allow_settings_users = models.BooleanField(default=True, help_text='Manage users')
    allow_settings_outlets = models.BooleanField(default=True, help_text='Manage outlets')
    allow_settings_integrations = models.BooleanField(default=True, help_text='Third-party integrations')
    allow_settings_advanced = models.BooleanField(default=True, help_text='Advanced settings')
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'tenant_permissions'
        verbose_name = 'Tenant Permission'
        verbose_name_plural = 'Tenant Permissions'
    
    def __str__(self):
        return f"Permissions for {self.tenant.name}"
    
    def has_app_permission(self, app_name):
        """Check if tenant has access to an app"""
        field_name = f"allow_{app_name}"
        return getattr(self, field_name, False)
    
    def has_feature_permission(self, feature_name):
        """Check if tenant has access to a feature"""
        return getattr(self, feature_name, False)


# Signal to create default permissions when a tenant is created
@receiver(post_save, sender=Tenant)
def create_default_tenant_permissions(sender, instance, created, **kwargs):
    """Automatically create default permissions for a new tenant"""
    if created:
        try:
            TenantPermissions.objects.create(tenant=instance)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to create default permissions for tenant {instance.id}: {str(e)}")
