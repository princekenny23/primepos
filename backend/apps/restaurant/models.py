from django.db import models
from apps.tenants.models import Tenant
from apps.outlets.models import Outlet


class Table(models.Model):
    """Restaurant table model for table management"""
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('occupied', 'Occupied'),
        ('reserved', 'Reserved'),
        ('out_of_service', 'Out of Service'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='restaurant_tables')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='restaurant_tables', null=True, blank=True)
    number = models.CharField(max_length=50)
    capacity = models.PositiveIntegerField(default=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    location = models.CharField(max_length=255, blank=True, help_text="e.g., Main Dining, Patio, VIP")
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurant_table'
        verbose_name = 'Restaurant Table'
        verbose_name_plural = 'Restaurant Tables'
        ordering = ['number']
        unique_together = ['tenant', 'number']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        outlet_name = self.outlet.name if self.outlet else "No Outlet"
        return f"{self.tenant.name} - Table {self.number} ({outlet_name})"


class KitchenOrderTicket(models.Model):
    """Kitchen Order Ticket (KOT) model for tracking orders sent to kitchen"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready'),
        ('served', 'Served'),
        ('cancelled', 'Cancelled'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='kitchen_tickets')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='kitchen_tickets', null=True, blank=True)
    till = models.ForeignKey('outlets.Till', on_delete=models.SET_NULL, null=True, blank=True, related_name='kitchen_orders', help_text="Till/POS terminal that created this order")
    sale = models.ForeignKey('sales.Sale', on_delete=models.CASCADE, related_name='kitchen_tickets')
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, related_name='kitchen_orders')
    
    kot_number = models.CharField(max_length=50, unique=True, db_index=True, help_text="Kitchen Order Ticket number")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=20, choices=[('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], default='normal')
    
    sent_to_kitchen_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurant_kitchenorderticket'
        verbose_name = 'Kitchen Order Ticket'
        verbose_name_plural = 'Kitchen Order Tickets'
        ordering = ['-sent_to_kitchen_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['sale']),
            models.Index(fields=['table']),
            models.Index(fields=['status']),
            models.Index(fields=['sent_to_kitchen_at']),
        ]

    def __str__(self):
        return f"KOT-{self.kot_number} - Table {self.table.number if self.table else 'N/A'}"



class RestaurantOrder(models.Model):
    "Restaurant Order model for persistent order session tracking"
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='restaurant_orders')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='restaurant_orders')
    till = models.ForeignKey('outlets.Till', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    shift = models.ForeignKey('shifts.Shift', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    
    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    customer_name = models.CharField(max_length=255)
    
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    order_type = models.CharField(max_length=20, choices=[
        ('dine_in', 'Dine In'),
        ('takeout', 'Takeout'),
        ('delivery', 'Delivery'),
    ], default='dine_in')
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_type = models.CharField(max_length=20, choices=[('percentage', 'Percentage'), ('amount', 'Amount')], null=True, blank=True)
    discount_reason = models.CharField(max_length=255, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    payment_method = models.CharField(max_length=20, choices=[
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('mobile', 'Mobile Money'),
        ('credit', 'Credit/On Account'),
    ], null=True, blank=True)
    
    sale = models.OneToOneField('sales.Sale', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_order')
    
    notes = models.TextField(blank=True)
    guests = models.PositiveIntegerField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=[('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], default='normal')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'restaurant_restaurantorder'
        verbose_name = 'Restaurant Order'
        verbose_name_plural = 'Restaurant Orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['table']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        table_info = f"Table {self.table.number}" if self.table else self.order_type.replace('_', ' ').title()
        return f"Order #{self.order_number} - {self.customer_name} ({table_info})"
