from django.db import models  # pyright: ignore[reportMissingImports]
from django.core.validators import MinValueValidator  # pyright: ignore[reportMissingImports]
from decimal import Decimal
from apps.tenants.models import Tenant
from apps.outlets.models import Outlet
from apps.products.models import Product
from apps.accounts.models import User


class Supplier(models.Model):
    """Supplier/Vendor model"""
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='suppliers')
    outlet = models.ForeignKey(Outlet, on_delete=models.SET_NULL, null=True, blank=True, related_name='suppliers')
    
    name = models.CharField(max_length=255)
    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)  # State/Province
    zip_code = models.CharField(max_length=20, blank=True)  # ZIP/Postal Code
    country = models.CharField(max_length=100, blank=True)
    tax_id = models.CharField(max_length=50, blank=True)
    
    payment_terms = models.CharField(max_length=100, blank=True)  # e.g., "Net 30", "COD"
    notes = models.TextField(blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'suppliers_supplier'
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'
        ordering = ['name']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
        ]

    def __str__(self):
        return self.name


class PurchaseOrder(models.Model):
    """Purchase Order model"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_supplier', 'Pending Supplier'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('ready_to_order', 'Ready to Order'),
        ('ordered', 'Ordered'),
        ('received', 'Received'),
        ('partial', 'Partially Received'),
        ('cancelled', 'Cancelled'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='purchase_orders')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders', help_text="Optional: Can be assigned later.")
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='purchase_orders')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_purchase_orders')
    
    po_number = models.CharField(max_length=50, unique=True, db_index=True)
    order_date = models.DateField()
    expected_delivery_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    
    notes = models.TextField(blank=True)
    terms = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'suppliers_purchaseorder'
        verbose_name = 'Purchase Order'
        verbose_name_plural = 'Purchase Orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['supplier']),
            models.Index(fields=['outlet']),
            models.Index(fields=['status']),
            models.Index(fields=['po_number']),
            models.Index(fields=['order_date']),
        ]

    def __str__(self):
        supplier_name = self.supplier.name if self.supplier else "No Supplier"
        return f"PO-{self.po_number} - {supplier_name}"
    
    def clean(self):
        """Validate that supplier is required for certain statuses"""
        from django.core.exceptions import ValidationError
        # Supplier is optional for draft and pending_supplier statuses
        if self.status not in ['draft', 'pending_supplier', 'cancelled']:
            if not self.supplier:
                raise ValidationError(
                    "Supplier is required for purchase orders beyond draft/pending_supplier status."
                )


class SupplierInvoice(models.Model):
    """Supplier Invoice model"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Payment'),
        ('partial', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='supplier_invoices')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='invoices')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='supplier_invoices')
    
    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    supplier_invoice_number = models.CharField(max_length=100, blank=True, help_text="Invoice number from supplier")
    invoice_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    total = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    
    notes = models.TextField(blank=True)
    payment_terms = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'suppliers_supplierinvoice'
        verbose_name = 'Supplier Invoice'
        verbose_name_plural = 'Supplier Invoices'
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['supplier']),
            models.Index(fields=['purchase_order']),
            models.Index(fields=['outlet']),
            models.Index(fields=['status']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['due_date']),
        ]

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.supplier.name}"
    
    @property
    def balance(self):
        """Calculate remaining balance"""
        return self.total - self.amount_paid
    
    def update_status(self):
        """Update invoice status based on payment"""
        if self.amount_paid >= self.total:
            self.status = 'paid'
            if not self.paid_at:
                from django.utils import timezone
                self.paid_at = timezone.now()
        elif self.amount_paid > 0:
            self.status = 'partial'
        else:
            from django.utils import timezone
            if timezone.now().date() > self.due_date:
                self.status = 'overdue'
            else:
                self.status = 'pending'
        self.save(update_fields=['status', 'paid_at'])


class PurchaseReturn(models.Model):
    """Purchase Return model"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('returned', 'Returned'),
        ('cancelled', 'Cancelled'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='purchase_returns')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='purchase_returns')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='returns')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='purchase_returns')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_purchase_returns')
    
    return_number = models.CharField(max_length=50, unique=True, db_index=True)
    return_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    reason = models.TextField(help_text="Reason for return")
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'suppliers_purchasereturn'
        verbose_name = 'Purchase Return'
        verbose_name_plural = 'Purchase Returns'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['supplier']),
            models.Index(fields=['purchase_order']),
            models.Index(fields=['outlet']),
            models.Index(fields=['status']),
            models.Index(fields=['return_number']),
        ]

    def __str__(self):
        return f"Return {self.return_number} - {self.supplier.name}"


class PurchaseReturnItem(models.Model):
    """Purchase Return Item model"""
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='purchase_return_items')
    purchase_return = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_return_items')

    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    reason = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'suppliers_purchasereturnitem'
        verbose_name = 'Purchase Return Item'
        verbose_name_plural = 'Purchase Return Items'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['purchase_return']),
            models.Index(fields=['product']),
        ]

    def __str__(self):
        return f"{self.product.name} x{self.quantity}"
    
class ProductSupplier(models.Model):
    """
    Product-Supplier relationship model
    Links products to suppliers
    """
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='product_suppliers')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='product_suppliers')
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='product_suppliers')
    
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Cost per unit from this supplier (if different from product cost)"
    )
    is_preferred = models.BooleanField(
        default=False,
        help_text="Preferred supplier for this product"
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'suppliers_productsupplier'
        verbose_name = 'Product Supplier'
        verbose_name_plural = 'Product Suppliers'
        unique_together = [['product', 'supplier']]
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['product']),
            models.Index(fields=['supplier']),
            models.Index(fields=['is_preferred']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.supplier.name}"