from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from apps.tenants.models import Tenant
from apps.outlets.models import Outlet
from apps.products.models import Product
from apps.accounts.models import User
from apps.shifts.models import Shift


class Sale(models.Model):
    """Sale/Transaction model"""
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('mobile', 'Mobile Money'),
        ('tab', 'Tab'),
        ('credit', 'Credit'),
    ]

    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('pending', 'Pending'),
        ('refunded', 'Refunded'),
        ('cancelled', 'Cancelled'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='sales')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='sales')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sales')
    shift = models.ForeignKey('shifts.Shift', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')
    till = models.ForeignKey('outlets.Till', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales', help_text="Till/POS terminal used for this sale")
    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    
    # Restaurant-specific fields
    table = models.ForeignKey('restaurant.Table', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders', help_text="Table for restaurant orders")
    guests = models.PositiveIntegerField(null=True, blank=True, help_text="Number of guests at table")
    priority = models.CharField(max_length=20, choices=[('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], default='normal', help_text="Order priority for kitchen")
    
    receipt_number = models.CharField(max_length=50, unique=True, db_index=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    total = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    
    # Cash payment fields (for cash-only sales)
    cash_received = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Cash amount received from customer (for cash payments)"
    )
    change_given = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Change given to customer (cash_received - total)"
    )
    
    # Credit/Accounts Receivable Fields
    due_date = models.DateTimeField(null=True, blank=True, help_text="Payment due date for credit sales")
    amount_paid = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Amount paid towards this sale (for credit sales)"
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='paid',
        help_text="Payment status for credit sales"
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_sale'
        verbose_name = 'Sale'
        verbose_name_plural = 'Sales'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['user']),
            models.Index(fields=['shift']),
            models.Index(fields=['created_at']),
            models.Index(fields=['receipt_number']),
        ]

    def __str__(self):
        return f"{self.receipt_number} - {self.total}"
    
    @property
    def is_credit_sale(self):
        """Check if this is a credit sale"""
        return self.payment_method == 'credit'
    
    @property
    def remaining_balance(self):
        """Calculate remaining balance for credit sales"""
        if not self.is_credit_sale:
            return Decimal('0')
        return max(Decimal('0'), self.total - self.amount_paid)
    
    def update_payment_status(self):
        """Update payment status based on amount_paid"""
        if not self.is_credit_sale:
            self.payment_status = 'paid'
            return
        
        if self.amount_paid >= self.total:
            self.payment_status = 'paid'
        elif self.amount_paid > 0:
            self.payment_status = 'partially_paid'
        else:
            # Check if overdue
            if self.due_date and self.due_date < timezone.now():
                self.payment_status = 'overdue'
            else:
                self.payment_status = 'unpaid'
        self.save(update_fields=['payment_status'])


class SaleItem(models.Model):
    """Sale line item model"""
    KITCHEN_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready'),
        ('served', 'Served'),
        ('cancelled', 'Cancelled'),
    ]
    
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='sale_items', help_text="Product sold")
    unit = models.ForeignKey('products.ProductUnit', on_delete=models.SET_NULL, null=True, blank=True, related_name='sale_items', help_text="Product unit used for this sale (e.g., piece, dozen, box)")
    product_name = models.CharField(max_length=255)  # Store name in case product is deleted
    unit_name = models.CharField(max_length=50, blank=True, help_text="Unit name snapshot (e.g., 'piece', 'dozen')")
    quantity = models.IntegerField(validators=[MinValueValidator(1)], help_text="Quantity sold in the selected unit")
    quantity_in_base_units = models.IntegerField(validators=[MinValueValidator(1)], default=1, help_text="Quantity in base units (for inventory deduction)")
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    total = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    
    # Restaurant-specific fields
    kitchen_status = models.CharField(max_length=20, choices=KITCHEN_STATUS_CHOICES, default='pending', help_text="Kitchen preparation status")
    notes = models.TextField(blank=True, help_text="Special instructions or modifiers for kitchen")
    prepared_at = models.DateTimeField(null=True, blank=True, help_text="When item was marked as ready")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sales_saleitem'
        verbose_name = 'Sale Item'
        verbose_name_plural = 'Sale Items'
        indexes = [
            models.Index(fields=['sale']),
            models.Index(fields=['product']),
            models.Index(fields=['unit']),
        ]

    def save(self, *args, **kwargs):
        """Auto-set product and names from unit if needed"""
        # Ensure product is set from unit if not already
        if self.unit and not self.product:
            self.product = self.unit.product
        
        # Set product name from product if not already set
        if self.product and not self.product_name:
            self.product_name = self.product.name
        
        # Store unit name snapshot
        if self.unit and not self.unit_name:
            self.unit_name = self.unit.unit_name
        
        # Calculate quantity_in_base_units if unit is provided
        if self.unit and not self.quantity_in_base_units:
            self.quantity_in_base_units = self.unit.convert_to_base_units(self.quantity)
        elif not self.unit:
            # If no unit, quantity_in_base_units equals quantity (assume base unit)
            self.quantity_in_base_units = self.quantity
        
        super().save(*args, **kwargs)

    def __str__(self):
        display_name = f"{self.product_name}"
        if self.unit_name:
            display_name += f" ({self.unit_name})"
        return f"{display_name} x{self.quantity}"


class Receipt(models.Model):
    """Digital receipt stored in database.

    Key invariants enforced here (Square-style):
    - Receipts are immutable legal records once created. Attempts to modify
      `sale`, `format` or `content` on an existing Receipt will raise an error.
    - Receipts are versioned: regenerating a receipt will create a new Receipt
      record and mark the previous one `is_current=False` and `voided=True`.
    - The backend is the single source of truth: frontends MUST NOT edit stored
      receipt content and must request the server for previews/printing.
    """
    FORMAT_CHOICES = [
        ('html', 'HTML'),
        ('pdf', 'PDF'),
        ('json', 'JSON'),
        ('escpos', 'ESC/POS'),
    ]
    
    SENT_VIA_CHOICES = [
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('print', 'Print'),
        ('none', 'Not Sent'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='receipts')
    # Change to ForeignKey to allow versioning/history of receipts while keeping
    # receipts immutable. Use related_name='receipts' to find all receipts for a sale.
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='receipts', help_text="The sale this receipt belongs to")
    # Note: receipt_number is not unique to allow versioning/history for the same sale
    receipt_number = models.CharField(max_length=50, db_index=True, help_text="Receipt number for quick lookup")
    
    # Receipt content
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='json', help_text="Format of stored receipt")
    content = models.TextField(help_text="Receipt content (HTML/JSON/ESC/POS base64)")
    pdf_file = models.FileField(upload_to='receipts/pdf/', null=True, blank=True, help_text="PDF file if format is PDF")
    
    # Versioning / immutability
    is_current = models.BooleanField(default=True, help_text="Whether this is the current receipt for the sale/format")
    voided = models.BooleanField(default=False, help_text="Whether this receipt has been voided/superseded")
    superseded_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='supersedes', help_text="If superseded, reference to the new receipt")

    # Metadata
    generated_at = models.DateTimeField(auto_now_add=True, help_text="When receipt was generated")
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='generated_receipts', help_text="User who created the receipt")
    
    # Delivery tracking
    is_sent = models.BooleanField(default=False, help_text="Whether receipt was sent to customer")

    sent_at = models.DateTimeField(null=True, blank=True, help_text="When receipt was sent")
    sent_via = models.CharField(max_length=20, choices=SENT_VIA_CHOICES, default='none', help_text="Method used to send receipt")
    
    # Access tracking
    access_count = models.IntegerField(default=0, help_text="Number of times receipt was accessed")
    last_accessed_at = models.DateTimeField(null=True, blank=True, help_text="Last time receipt was accessed")
    
    class Meta:
        db_table = 'sales_receipt'
        verbose_name = 'Receipt'
        verbose_name_plural = 'Receipts'
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['sale']),
            models.Index(fields=['receipt_number']),
            models.Index(fields=['generated_at']),
        ]
    
    def __str__(self):
        return f"Receipt {self.receipt_number}"

    def increment_access(self):
        """Increment access count and update last accessed time"""
        self.access_count += 1
        self.last_accessed_at = timezone.now()
        self.save(update_fields=['access_count', 'last_accessed_at'])

    def save(self, *args, **kwargs):
        """Enforce immutability for created receipts.

        Once created, you must not change `sale`, `format` or `content` fields.
        To update a receipt (e.g., regenerate), create a new Receipt record and
        mark the old one `voided=True` and `is_current=False`.
        """
        if self.pk:
            # Fetch current stored values and compare
            try:
                orig = Receipt.objects.get(pk=self.pk)
                if (orig.sale_id != self.sale_id) or (orig.format != self.format) or (orig.content != self.content):
                    raise ValueError('Receipts are immutable once created. Create a new receipt to replace an existing one.')
            except Receipt.DoesNotExist:
                # Shouldn't happen, but allow save in that case
                pass
        super().save(*args, **kwargs)


class ReceiptTemplate(models.Model):
    """Per-tenant editable receipt template.

    Tenants can manage their own receipt appearance. The system will prefer
    the tenant's default template when printing receipts.
    """
    FORMAT_CHOICES = [
        ('text', 'Plain Text'),
        ('html', 'HTML'),
        ('json', 'JSON'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='receipt_templates')
    name = models.CharField(max_length=100, default='Default Template')
    format = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='text')
    content = models.TextField(blank=True, help_text='Template content (text/html/json)')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_receipttemplate'
        verbose_name = 'Receipt Template'
        verbose_name_plural = 'Receipt Templates'
        unique_together = [['tenant', 'name']]
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.tenant.name} - {self.name}"

    def save(self, *args, **kwargs):
        # If marking as default, unset other defaults for this tenant
        if self.is_default:
            if self.pk:
                ReceiptTemplate.objects.filter(tenant=self.tenant).exclude(pk=self.pk).update(is_default=False)
            else:
                ReceiptTemplate.objects.filter(tenant=self.tenant).update(is_default=False)
        super().save(*args, **kwargs)

