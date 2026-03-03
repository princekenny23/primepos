from django.contrib import admin
from .models import Vehicle, DriverProfile, Delivery, VehicleLocation


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('id', 'tenant', 'plate_number', 'make', 'model', 'is_active', 'created_at')
    search_fields = ('plate_number', 'make', 'model', 'tenant__name')
    list_filter = ('tenant', 'is_active')


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'tenant', 'user', 'license_number', 'is_active', 'created_at')
    search_fields = ('user__email', 'user__name', 'license_number', 'tenant__name')
    list_filter = ('tenant', 'is_active')


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('id', 'tenant', 'sale', 'status', 'driver', 'vehicle', 'created_at')
    search_fields = ('sale__receipt_number', 'driver__email', 'vehicle__plate_number', 'tenant__name')
    list_filter = ('tenant', 'status')


@admin.register(VehicleLocation)
class VehicleLocationAdmin(admin.ModelAdmin):
    list_display = ('id', 'tenant', 'vehicle', 'delivery', 'latitude', 'longitude', 'recorded_at')
    search_fields = ('vehicle__plate_number', 'tenant__name')
    list_filter = ('tenant', 'recorded_at')
