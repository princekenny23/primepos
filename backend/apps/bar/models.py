"""
Bar Management Models - Tabs, Tables, and Bar-specific functionality
"""
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
import uuid

from apps.tenants.models import Tenant
from apps.outlets.models import Outlet
from apps.accounts.models import User
from apps.products.models import Product, ProductUnit
from apps.customers.models import Customer


class BarTable(models.Model):
    """
    Bar table/seating model - supports both physical tables and bar counter seats
    """
    TABLE_TYPE_CHOICES = [
        ('table', 'Table'),
        ('bar_seat', 'Bar Counter Seat'),
        ('booth', 'Booth'),
        ('patio', 'Patio'),
        ('vip', 'VIP Area'),
    ]
    
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('occupied', 'Occupied'),
        ('reserved', 'Reserved'),
        ('out_of_service', 'Out of Service'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='bar_tables')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='bar_tables', null=True, blank=True)
    
    number = models.CharField(max_length=50, help_text="Table number or seat identifier (e.g., 'Table 5', 'Bar Seat 3')")
    table_type = models.CharField(max_length=20, choices=TABLE_TYPE_CHOICES, default='table')
    capacity = models.PositiveIntegerField(default=2, help_text="Maximum seating capacity")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    location = models.CharField(max_length=255, blank=True, help_text="e.g., Main Bar, Patio, VIP Lounge")
    
    # For floor plan positioning
    position_x = models.IntegerField(default=0, help_text="X position on floor plan")
    position_y = models.IntegerField(default=0, help_text="Y position on floor plan")
    
    # Current tab (if occupied)
    current_tab = models.OneToOneField(
        'Tab', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='assigned_table',
        help_text="Currently active tab at this table"
    )
    
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bar_table'
        verbose_name = 'Bar Table'
        verbose_name_plural = 'Bar Tables'
        ordering = ['table_type', 'number']
        unique_together = ['tenant', 'outlet', 'number']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['status']),
            models.Index(fields=['table_type']),
        ]

    def __str__(self):
        return f"{self.number} ({self.get_table_type_display()})"
    
    def open_tab(self, tab):
        """Assign a tab to this table and mark as occupied"""
        self.current_tab = tab
        self.status = 'occupied'
        self.save(update_fields=['current_tab', 'status', 'updated_at'])
    
    def close_tab(self):
        """Remove tab from table and mark as available"""
        self.current_tab = None
        self.status = 'available'
        self.save(update_fields=['current_tab', 'status', 'updated_at'])


class Tab(models.Model):
    """
    Bar Tab model - represents an open bill that can accumulate items over time
    Tabs can span multiple shifts (customer loan/credit system)
    """
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('merged', 'Merged'),  # When merged into another tab
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='bar_tabs')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='bar_tabs', null=True, blank=True)
    
    # Tab identification
    tab_number = models.CharField(max_length=50, unique=True, db_index=True, help_text="Auto-generated tab number")
    
    # Customer info (optional - can be anonymous)
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='bar_tabs',
        help_text="Linked customer account (for credit tracking)"
    )
    customer_name = models.CharField(
        max_length=255, 
        blank=True, 
        help_text="Customer name for display (e.g., 'John', 'Guy in red shirt')"
    )
    customer_phone = models.CharField(max_length=50, blank=True, help_text="Contact phone for callbacks")
    
    # Table assignment (optional - can be walk-up/bar counter)
    table = models.ForeignKey(
        BarTable, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='tabs_history',
        help_text="Current table assignment"
    )
    
    # Staff tracking
    opened_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='tabs_opened',
        help_text="Bartender who opened the tab"
    )
    closed_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='tabs_closed',
        help_text="Bartender who closed the tab"
    )
    
    # Status and timing
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    # Financial summary (updated on each item add/remove)
    subtotal = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    discount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    tax = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    total = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    
    # Limit/Credit control
    credit_limit = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Maximum allowed tab amount (optional)"
    )
    
    # Reference to final sale (when closed)
    sale = models.OneToOneField(
        'sales.Sale', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='source_tab',
        help_text="Final sale created when tab is closed"
    )
    
    # Merge tracking
    merged_into = models.ForeignKey(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='merged_tabs',
        help_text="If merged, the tab this was merged into"
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bar_tab'
        verbose_name = 'Bar Tab'
        verbose_name_plural = 'Bar Tabs'
        ordering = ['-opened_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['status']),
            models.Index(fields=['opened_at']),
            models.Index(fields=['tab_number']),
            models.Index(fields=['customer']),
        ]

    def __str__(self):
        customer_display = self.customer_name or (self.customer.name if self.customer else 'Anonymous')
        return f"Tab #{self.tab_number} - {customer_display}"
    
    def save(self, *args, **kwargs):
        # Generate tab number if not set
        if not self.tab_number:
            self.tab_number = self.generate_tab_number()
        super().save(*args, **kwargs)
    
    def generate_tab_number(self):
        """Generate unique tab number: TAB-YYYYMMDD-XXXX"""
        today = timezone.now().strftime('%Y%m%d')
        prefix = f"TAB-{today}-"
        
        # Get the last tab number for today
        last_tab = Tab.objects.filter(
            tab_number__startswith=prefix
        ).order_by('-tab_number').first()
        
        if last_tab:
            try:
                last_num = int(last_tab.tab_number.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
        
        return f"{prefix}{new_num:04d}"
    
    def recalculate_totals(self):
        """Recalculate tab totals from items"""
        items = self.items.filter(is_voided=False)
        self.subtotal = sum(item.total for item in items)
        self.total = self.subtotal - self.discount + self.tax
        self.save(update_fields=['subtotal', 'total', 'updated_at'])
    
    @property
    def item_count(self):
        """Get total number of items on tab"""
        return self.items.filter(is_voided=False).aggregate(
            total=models.Sum('quantity')
        )['total'] or 0
    
    @property
    def display_name(self):
        """Get display name for the tab"""
        if self.customer_name:
            return self.customer_name
        if self.customer:
            return self.customer.name
        if self.table:
            return f"Table {self.table.number}"
        return f"Tab #{self.tab_number[-4:]}"
    
    @property
    def is_over_limit(self):
        """Check if tab has exceeded credit limit"""
        if self.credit_limit is None:
            return False
        return self.total > self.credit_limit


class TabItem(models.Model):
    """
    Tab line item - tracks each drink/item added to a tab
    Includes bartender tracking for accountability
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tab = models.ForeignKey(Tab, on_delete=models.CASCADE, related_name='items')
    
    # Product reference
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='tab_items')
    unit = models.ForeignKey(
        ProductUnit, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='tab_items'
    )
    
    # Quantity and pricing
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0'))]
    )
    discount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    total = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0'))]
    )
    
    # Staff tracking - who added this item
    added_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='tab_items_added',
        help_text="Bartender who added this item"
    )
    
    # Voiding (instead of deleting, for audit trail)
    is_voided = models.BooleanField(default=False)
    voided_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='tab_items_voided',
        help_text="Bartender who voided this item"
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    void_reason = models.CharField(max_length=255, blank=True)
    
    notes = models.TextField(blank=True, help_text="Special instructions, modifiers")
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bar_tab_item'
        verbose_name = 'Tab Item'
        verbose_name_plural = 'Tab Items'
        ordering = ['added_at']
        indexes = [
            models.Index(fields=['tab']),
            models.Index(fields=['product']),
            models.Index(fields=['added_by']),
            models.Index(fields=['added_at']),
            models.Index(fields=['is_voided']),
        ]

    def __str__(self):
        return f"{self.quantity}x {self.product.name} - {self.tab.tab_number}"
    
    def save(self, *args, **kwargs):
        # Calculate total before saving
        self.total = (self.price * self.quantity) - self.discount
        super().save(*args, **kwargs)
        
        # Recalculate tab totals
        self.tab.recalculate_totals()
    
    def void(self, voided_by, reason=''):
        """Void this item (soft delete)"""
        self.is_voided = True
        self.voided_by = voided_by
        self.voided_at = timezone.now()
        self.void_reason = reason
        self.save()


class TabTransfer(models.Model):
    """
    Tab Transfer history - tracks when tabs are moved between tables
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tab = models.ForeignKey(Tab, on_delete=models.CASCADE, related_name='transfers')
    
    from_table = models.ForeignKey(
        BarTable, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='transfers_out',
        help_text="Previous table (null if was walk-up)"
    )
    to_table = models.ForeignKey(
        BarTable, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='transfers_in',
        help_text="New table (null if becoming walk-up)"
    )
    
    transferred_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='tab_transfers')
    reason = models.CharField(max_length=255, blank=True)
    transferred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bar_tab_transfer'
        verbose_name = 'Tab Transfer'
        verbose_name_plural = 'Tab Transfers'
        ordering = ['-transferred_at']

    def __str__(self):
        from_name = self.from_table.number if self.from_table else 'Walk-up'
        to_name = self.to_table.number if self.to_table else 'Walk-up'
        return f"Tab #{self.tab.tab_number}: {from_name} → {to_name}"


class TabMerge(models.Model):
    """
    Tab Merge history - tracks when multiple tabs are combined
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    target_tab = models.ForeignKey(
        Tab, 
        on_delete=models.CASCADE, 
        related_name='merge_records',
        help_text="The tab that received merged items"
    )
    source_tab = models.ForeignKey(
        Tab, 
        on_delete=models.CASCADE, 
        related_name='merged_into_records',
        help_text="The tab that was merged (and closed)"
    )
    
    source_total = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="Total of source tab at time of merge"
    )
    
    merged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='tab_merges')
    reason = models.CharField(max_length=255, blank=True)
    merged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bar_tab_merge'
        verbose_name = 'Tab Merge'
        verbose_name_plural = 'Tab Merges'
        ordering = ['-merged_at']

    def __str__(self):
        return f"Tab #{self.source_tab.tab_number} → Tab #{self.target_tab.tab_number}"
