from django.db import models
from apps.tenants.models import Tenant


class Outlet(models.Model):
    """Outlet/Branch model for multi-location businesses"""
    BUSINESS_TYPE_CHOICES = [
        ("wholesale_and_retail", "Wholesale and Retail"),
        ("restaurant", "Restaurant"),
        ("bar", "Bar"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='outlets')
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    business_type = models.CharField(
        max_length=30,
        choices=BUSINESS_TYPE_CHOICES,
        default="wholesale_and_retail",
        help_text="Business type for this outlet",
    )
    settings = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'outlets_outlet'
        verbose_name = 'Outlet'
        verbose_name_plural = 'Outlets'
        ordering = ['name']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['tenant', 'business_type']),
        ]

    def __str__(self):
        return f"{self.tenant.name} - {self.name} ({self.get_business_type_display()})"


class Till(models.Model):
    """Cash register till model"""
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='tills')
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    is_in_use = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'outlets_till'
        verbose_name = 'Till'
        verbose_name_plural = 'Tills'
        ordering = ['name']
        indexes = [
            models.Index(fields=['outlet']),
        ]

    def __str__(self):
        return f"{self.outlet.name} - {self.name}"


class Printer(models.Model):
    """Receipt/Label printer registered to an outlet

    'identifier' should be a unique string reported by the discovery mechanism
    (for QZ Tray this is typically the printer name). We enforce uniqueness per outlet
    to avoid redundant printer entries.
    """
    PRINTER_DRIVER_CHOICES = [
        ("qz", "QZ Tray"),
        ("network", "Network/TCP"),
        ("bluetooth", "Bluetooth"),
        ("other", "Other"),
    ]

    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='printers')
    name = models.CharField(max_length=255)
    identifier = models.CharField(max_length=512)
    driver = models.CharField(max_length=32, choices=PRINTER_DRIVER_CHOICES, default="qz")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'outlets_printer'
        verbose_name = 'Printer'
        verbose_name_plural = 'Printers'
        unique_together = (('outlet', 'identifier'),)
        # Ensure a deterministic ordering for paginated queries to avoid
        # UnorderedObjectListWarning from Django REST Framework pagination.
        # Default to listing the default printer first, then by name.
        ordering = ['-is_default', 'name']
        indexes = [
            models.Index(fields=['outlet']),
            models.Index(fields=['identifier']),
        ]

    def __str__(self):
        return f"{self.outlet.name} - {self.name} ({self.identifier})"

    def save(self, *args, **kwargs):
        # If this instance will be the default printer, unset other defaults
        # for the same outlet before saving to avoid a transient state with
        # multiple default printers. For updates, exclude self; for new
        # instances (no PK yet) clear all other defaults.
        if self.is_default:
            if self.pk:
                Printer.objects.filter(outlet=self.outlet).exclude(pk=self.pk).update(is_default=False)
            else:
                Printer.objects.filter(outlet=self.outlet).update(is_default=False)

        super().save(*args, **kwargs)

