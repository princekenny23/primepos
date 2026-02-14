from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from apps.tenants.models import Tenant


class Category(models.Model):
    """Product category model"""
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'products_category'
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'
        ordering = ['name']
        unique_together = ['tenant', 'name']
        indexes = [
            models.Index(fields=['tenant']),
        ]

    def __str__(self):
        return self.name


class Product(models.Model):
    """Product model - outlet-specific"""
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='products')
    outlet = models.ForeignKey('outlets.Outlet', on_delete=models.CASCADE, related_name='products', help_text="Outlet this product belongs to")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sku = models.CharField(max_length=100, db_index=True, blank=True, null=True)
    barcode = models.CharField(max_length=100, blank=True, db_index=True)
    retail_price = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))], help_text="Retail price")
    cost = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal('0'))], help_text="Cost price")
    
    @property
    def cost_price(self):
        """Alias for cost field for backward compatibility"""
        return self.cost
    
    @property
    def price(self):
        """Backward compatibility: return retail_price"""
        return self.retail_price
    # Wholesale pricing fields
    wholesale_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal('0.01'))], help_text="Wholesale price")
    wholesale_enabled = models.BooleanField(default=False, help_text="Whether this product is available for wholesale")
    minimum_wholesale_quantity = models.IntegerField(default=1, validators=[MinValueValidator(1)], help_text="Minimum quantity required for wholesale pricing")
    stock = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    low_stock_threshold = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    unit = models.CharField(max_length=50, default='pcs')
    
    # Expiry tracking fields
    track_expiration = models.BooleanField(default=False, help_text="Whether to track expiration for this product")
    manufacturing_date = models.DateField(null=True, blank=True, help_text="Product manufacturing date")
    expiry_date = models.DateField(null=True, blank=True, help_text="Product expiry date")
    
    # Restaurant-specific fields
    preparation_time = models.IntegerField(null=True, blank=True, help_text="Prep time in minutes for restaurant items")
    
    # Bar-specific fields
    volume_ml = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal('0.01'))], help_text="Volume in milliliters for bar items")
    alcohol_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))], help_text="Alcohol percentage for bar items")
    
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products_product'
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
        ordering = ['name']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['tenant', 'outlet']),
            models.Index(fields=['category']),
            models.Index(fields=['sku']),
            models.Index(fields=['barcode']),
        ]
        # Note: unique_together doesn't work well with blank values
        # SKU uniqueness is enforced in the serializer

    def __str__(self):
        return self.name

    def get_total_stock(self, outlet=None):
        """Get total stock from all units using batch-aware calculation"""
        from apps.inventory.stock_helpers import get_available_stock
        from apps.outlets.models import Outlet
        
        # Get all active units
        units = self.selling_units.filter(is_active=True)
        
        if not units.exists():
            # Fallback to legacy stock field if no units
            return self.stock
        
        # Sum stock from all units (each with conversion_factor)
        # Base unit has conversion_factor=1.0, represents actual stock
        if outlet:
            # Get stock for specific outlet from non-expired batches
            return sum(get_available_stock(unit, outlet) for unit in units)
        else:
            # Sum across all outlets
            total = 0
            outlets = Outlet.objects.filter(tenant=self.tenant)
            for unit in units:
                for outlet_obj in outlets:
                    total += get_available_stock(unit, outlet_obj)
            return total
    
    @property
    def is_low_stock(self):
        """Check if product is low on stock by checking all units (computed from batches)"""
        # Check if any unit is low stock
        units = self.selling_units.filter(is_active=True)
        
        if not units.exists():
            # Fallback to legacy check if no units
            return self.low_stock_threshold > 0 and self.stock <= self.low_stock_threshold
        
        # Check each unit for low stock using batch-aware calculation
        for unit in units:
            from apps.inventory.stock_helpers import get_available_stock
            from apps.outlets.models import Outlet
            
            # Check stock across all outlets for this unit
            outlets = Outlet.objects.filter(tenant=self.tenant)
            for outlet in outlets:
                available_stock = get_available_stock(unit, outlet)
                if unit.low_stock_threshold > 0 and available_stock <= unit.low_stock_threshold:
                    return True
        
        # Also check product-level threshold if set (sum of all units)
        if self.low_stock_threshold > 0:
            total_stock = self.get_total_stock()
            if total_stock <= self.low_stock_threshold:
                return True
        
        return False
    
    @property
    def base_unit(self):
        """Get the base unit (conversion_factor = 1.0) - required for every product"""
        return self.selling_units.filter(conversion_factor=1.0).first()
    
    def get_price(self, sale_type='retail'):
        """Get price from base unit"""
        unit = self.base_unit
        if unit:
            if sale_type == 'wholesale' and unit.wholesale_price:
                return unit.wholesale_price
            return unit.retail_price
        return self.retail_price


class ProductUnit(models.Model):
    """
    Product Unit model for multi-unit selling - UNITS ONLY ARCHITECTURE
    Products are sold exclusively through units (piece, dozen, box, etc.)
    Each product MUST have at least one unit with conversion_factor=1.0 (base unit)
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='selling_units', help_text="Product this unit belongs to")
    unit_name = models.CharField(max_length=50, help_text="Unit name (e.g., 'piece', 'half-dozen', 'dozen', 'box')")
    conversion_factor = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(Decimal('1.0'))],
        help_text="How many base units this unit equals (minimum 1.0 for base unit)"
    )
    retail_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Retail price for this unit"
    )
    wholesale_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Wholesale price for this unit (optional)"
    )
    low_stock_threshold = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Low stock alert threshold for this unit"
    )
    is_active = models.BooleanField(default=True, help_text="Whether this unit is available for sale")
    sort_order = models.IntegerField(default=0, help_text="Sort order for display")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products_productunit'
        verbose_name = 'Product Unit'
        verbose_name_plural = 'Product Units'
        ordering = ['sort_order', 'unit_name', 'id']
        unique_together = [['product', 'unit_name']]  # Unit name unique per product
        constraints = [
            models.CheckConstraint(
                check=models.Q(conversion_factor__gte=1.0),
                name='conversion_factor_min_1',
                violation_error_message='Conversion factor must be at least 1.0'
            )
        ]
        indexes = [
            models.Index(fields=['product']),
            models.Index(fields=['product', 'is_active']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.unit_name}"
    
    def get_price(self, sale_type='retail'):
        """Get price based on sale type (retail or wholesale)"""
        if sale_type == 'wholesale' and self.wholesale_price:
            return self.wholesale_price
        return self.retail_price
    
    def convert_to_base_units(self, quantity):
        """Convert quantity in this unit to base units (quantity * conversion_factor)"""
        return int(quantity * self.conversion_factor)
    
    def convert_from_base_units(self, base_quantity):
        """Convert quantity from base units to this unit (base_quantity / conversion_factor)"""
        if self.conversion_factor == 0:
            return 0
        return base_quantity / self.conversion_factor
    
    @property
    def is_base_unit(self):
        """Check if this is the base unit (conversion_factor = 1.0)"""
        return self.conversion_factor == 1.0
    
    def get_total_stock(self, outlet=None):
        """Get total stock for this unit (batch-aware, excluding expired)"""
        from apps.inventory.stock_helpers import get_available_stock
        from apps.outlets.models import Outlet
        
        if outlet:
            return get_available_stock(self, outlet)
        
        # Sum across all outlets
        outlets = Outlet.objects.filter(tenant=self.product.tenant)
        return sum(get_available_stock(self, outlet) for outlet in outlets)
    
    @property
    def is_low_stock(self):
        """Check if unit is low on stock (batch-aware calculation)"""
        if self.low_stock_threshold <= 0:
            return False
        
        # Use batch-aware calculation
        from apps.inventory.stock_helpers import get_available_stock
        from apps.outlets.models import Outlet
        
        # Check across all outlets
        outlets = Outlet.objects.filter(tenant=self.product.tenant)
        for outlet in outlets:
            available_stock = get_available_stock(self, outlet)
            if available_stock <= self.low_stock_threshold:
                return True
        
        return False


