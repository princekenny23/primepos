from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.customers.models import Customer
from apps.outlets.models import Outlet
from apps.products.models import Product
from apps.sales.models import Sale
from apps.sales.models import SaleItem
from apps.tenants.models import Tenant


class Vehicle(models.Model):
    STATUS_AVAILABLE = 'available'
    STATUS_ON_TRIP = 'on_trip'
    STATUS_MAINTENANCE = 'maintenance'

    STATUS_CHOICES = [
        (STATUS_AVAILABLE, 'Available'),
        (STATUS_ON_TRIP, 'On Trip'),
        (STATUS_MAINTENANCE, 'Maintenance'),
    ]

    FUEL_DIESEL = 'diesel'
    FUEL_PETROL = 'petrol'
    FUEL_ELECTRIC = 'electric'
    FUEL_HYBRID = 'hybrid'

    FUEL_TYPE_CHOICES = [
        (FUEL_DIESEL, 'Diesel'),
        (FUEL_PETROL, 'Petrol'),
        (FUEL_ELECTRIC, 'Electric'),
        (FUEL_HYBRID, 'Hybrid'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='distribution_vehicles')
    plate_number = models.CharField(max_length=50)
    make = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    capacity_kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fuel_type = models.CharField(max_length=20, choices=FUEL_TYPE_CHOICES, default=FUEL_DIESEL)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'distribution_vehicle'
        unique_together = ('tenant', 'plate_number')
        ordering = ['plate_number']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['is_active']),
            models.Index(fields=['status']),
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['tenant', 'status']),
        ]

    def __str__(self):
        return f"{self.plate_number}"


class DriverProfile(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='distribution_drivers')
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='driver_profile')
    license_number = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'distribution_driver_profile'
        ordering = ['user__email']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['is_active']),
            models.Index(fields=['tenant', 'is_active']),
        ]

    def __str__(self):
        return f"{self.user.email}"


class Driver(models.Model):
    STATUS_AVAILABLE = 'available'
    STATUS_ON_TRIP = 'on_trip'
    STATUS_INACTIVE = 'inactive'

    STATUS_CHOICES = [
        (STATUS_AVAILABLE, 'Available'),
        (STATUS_ON_TRIP, 'On Trip'),
        (STATUS_INACTIVE, 'Inactive'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='fleet_drivers')
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30, blank=True)
    license_number = models.CharField(max_length=100)
    id_number = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'distribution_driver'
        ordering = ['name']
        unique_together = ('tenant', 'license_number')
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['status']),
            models.Index(fields=['tenant', 'status']),
        ]

    def __str__(self):
        return self.name


class Delivery(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_PENDING_DISPATCH = 'pending_dispatch'
    STATUS_IN_TRANSIT = 'in_transit'
    STATUS_DELIVERED = 'delivered'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_PENDING_DISPATCH, 'Pending Dispatch'),
        (STATUS_IN_TRANSIT, 'In Transit'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='deliveries')
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='deliveries')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_deliveries')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    dispatch_notes = models.TextField(blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_deliveries')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'distribution_delivery'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['sale']),
            models.Index(fields=['status']),
            models.Index(fields=['driver']),
            models.Index(fields=['vehicle']),
            models.Index(fields=['tenant', 'status']),
        ]

    def __str__(self):
        return f"Delivery #{self.id} - {self.sale.receipt_number}"

    def apply_status_timestamps(self):
        if self.status == self.STATUS_IN_TRANSIT and not self.dispatched_at:
            self.dispatched_at = timezone.now()
        if self.status == self.STATUS_DELIVERED and not self.delivered_at:
            self.delivered_at = timezone.now()


class VehicleLocation(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='vehicle_locations')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='locations')
    delivery = models.ForeignKey(Delivery, on_delete=models.SET_NULL, null=True, blank=True, related_name='locations')
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    speed_kph = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    recorded_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'distribution_vehicle_location'
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['vehicle']),
            models.Index(fields=['delivery']),
            models.Index(fields=['recorded_at']),
            models.Index(fields=['tenant', 'recorded_at']),
        ]

    def __str__(self):
        return f"{self.vehicle.plate_number} @ {self.recorded_at}"


class DeliveryOrder(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ASSIGNED = 'assigned'
    STATUS_IN_TRANSIT = 'in_transit'
    STATUS_DELIVERED = 'delivered'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ASSIGNED, 'Assigned'),
        (STATUS_IN_TRANSIT, 'In Transit'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='delivery_orders')
    sales_order = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='delivery_orders')
    warehouse = models.ForeignKey(Outlet, on_delete=models.PROTECT, related_name='delivery_orders')
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_orders')
    delivery_address = models.TextField(blank=True)
    delivery_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    assigned_vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_orders')
    assigned_driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_orders')
    trip_start_time = models.DateTimeField(null=True, blank=True)
    trip_end_time = models.DateTimeField(null=True, blank=True)
    proof_of_delivery = models.FileField(upload_to='distribution/pod/', null=True, blank=True)
    reservation_released_at = models.DateTimeField(null=True, blank=True)
    reserved_deducted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_delivery_orders')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'distribution_delivery_order'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['delivery_status']),
            models.Index(fields=['tenant', 'delivery_status']),
            models.Index(fields=['sales_order']),
            models.Index(fields=['warehouse']),
        ]

    def __str__(self):
        return f"DeliveryOrder #{self.id} - Sale {self.sales_order.receipt_number}"


class DeliveryOrderItem(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='delivery_order_items')
    delivery_order = models.ForeignKey(DeliveryOrder, on_delete=models.CASCADE, related_name='items')
    sale_item = models.ForeignKey(SaleItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='delivery_order_items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='delivery_order_items')
    quantity = models.PositiveIntegerField(default=1)
    is_released = models.BooleanField(default=False)
    is_deducted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'distribution_delivery_order_item'
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['delivery_order']),
            models.Index(fields=['product']),
            models.Index(fields=['is_released', 'is_deducted']),
        ]


class Trip(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='trips')
    delivery_order = models.ForeignKey(DeliveryOrder, on_delete=models.CASCADE, related_name='trips')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name='trips')
    driver = models.ForeignKey(Driver, on_delete=models.PROTECT, related_name='trips')
    fuel_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    distance_km = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'distribution_trip'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['delivery_order']),
            models.Index(fields=['vehicle']),
            models.Index(fields=['driver']),
        ]
