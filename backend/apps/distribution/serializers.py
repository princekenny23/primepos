from rest_framework import serializers

from apps.sales.models import Sale
from .models import DeliveryOrder, Driver, Trip, Vehicle
from .permissions import resolve_distribution_tenant


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = (
            'id', 'tenant', 'plate_number', 'make', 'model', 'capacity_kg',
            'fuel_type', 'status', 'is_active', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'created_at', 'updated_at')


class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = (
            'id', 'tenant', 'name', 'phone', 'license_number', 'id_number',
            'status', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'created_at', 'updated_at')

    def validate_license_number(self, value):
        request = self.context.get('request')
        tenant = resolve_distribution_tenant(request)
        if not tenant:
            raise serializers.ValidationError('Tenant is required. Provide tenant_id when acting as SaaS admin.')

        queryset = Driver.objects.filter(tenant=tenant, license_number=value)
        if self.instance:
            queryset = queryset.exclude(id=self.instance.id)
        if queryset.exists():
            raise serializers.ValidationError('A driver with this license number already exists for this tenant.')
        return value


class DeliveryOrderSerializer(serializers.ModelSerializer):
    sales_order_receipt_number = serializers.CharField(source='sales_order.receipt_number', read_only=True)
    assigned_vehicle_plate = serializers.CharField(source='assigned_vehicle.plate_number', read_only=True)
    assigned_driver_name = serializers.CharField(source='assigned_driver.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = DeliveryOrder
        fields = (
            'id', 'tenant', 'sales_order', 'sales_order_receipt_number',
            'warehouse', 'warehouse_name', 'customer', 'customer_name',
            'delivery_address', 'delivery_status',
            'assigned_vehicle', 'assigned_vehicle_plate',
            'assigned_driver', 'assigned_driver_name',
            'trip_start_time', 'trip_end_time', 'proof_of_delivery',
            'reservation_released_at', 'reserved_deducted_at',
            'created_by', 'created_at', 'updated_at'
        )
        read_only_fields = (
            'id', 'tenant', 'created_by', 'created_at', 'updated_at',
            'reservation_released_at', 'reserved_deducted_at'
        )

    def validate(self, attrs):
        request = self.context.get('request')
        tenant = resolve_distribution_tenant(request)
        if not tenant:
            raise serializers.ValidationError('Tenant is required. Provide tenant_id when acting as SaaS admin.')

        sales_order = attrs.get('sales_order') or getattr(self.instance, 'sales_order', None)
        if sales_order and sales_order.tenant_id != tenant.id:
            raise serializers.ValidationError({'sales_order': 'Sales order must belong to your tenant.'})
        if sales_order and not getattr(sales_order, 'delivery_required', False):
            raise serializers.ValidationError({'sales_order': 'DeliveryOrder can only be created when sale.delivery_required is true.'})

        warehouse = attrs.get('warehouse') or getattr(self.instance, 'warehouse', None)
        if warehouse and warehouse.tenant_id != tenant.id:
            raise serializers.ValidationError({'warehouse': 'Warehouse must belong to your tenant.'})

        customer = attrs.get('customer') or getattr(self.instance, 'customer', None)
        if customer and customer.tenant_id != tenant.id:
            raise serializers.ValidationError({'customer': 'Customer must belong to your tenant.'})

        assigned_vehicle = attrs.get('assigned_vehicle')
        if assigned_vehicle and assigned_vehicle.tenant_id != tenant.id:
            raise serializers.ValidationError({'assigned_vehicle': 'Assigned vehicle must belong to your tenant.'})

        assigned_driver = attrs.get('assigned_driver')
        if assigned_driver and assigned_driver.tenant_id != tenant.id:
            raise serializers.ValidationError({'assigned_driver': 'Assigned driver must belong to your tenant.'})

        return attrs


class TripSerializer(serializers.ModelSerializer):
    delivery_order_reference = serializers.SerializerMethodField()
    vehicle_plate_number = serializers.CharField(source='vehicle.plate_number', read_only=True)
    driver_name = serializers.CharField(source='driver.name', read_only=True)

    class Meta:
        model = Trip
        fields = (
            'id', 'tenant', 'delivery_order', 'delivery_order_reference',
            'vehicle', 'vehicle_plate_number', 'driver', 'driver_name',
            'fuel_cost', 'distance_km', 'total_cost', 'profit',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'created_at', 'updated_at')

    def get_delivery_order_reference(self, obj):
        if not obj.delivery_order:
            return None
        return {
            'id': obj.delivery_order.id,
            'sales_order_id': obj.delivery_order.sales_order_id,
            'receipt_number': getattr(obj.delivery_order.sales_order, 'receipt_number', None),
            'delivery_status': obj.delivery_order.delivery_status,
        }


class CreateDeliveryOrderFromSaleSerializer(serializers.Serializer):
    sale_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    delivery_address = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get('request')
        tenant = resolve_distribution_tenant(request)
        if not tenant:
            raise serializers.ValidationError('Tenant is required. Provide tenant_id when acting as SaaS admin.')

        try:
            sale = Sale.objects.get(id=attrs['sale_id'], tenant=tenant)
        except Sale.DoesNotExist:
            raise serializers.ValidationError({'sale_id': 'Sale not found in this tenant.'})
        if not getattr(sale, 'delivery_required', False):
            raise serializers.ValidationError({'sale_id': 'Sale does not require delivery.'})
        attrs['sale'] = sale

        warehouse_id = attrs.get('warehouse_id')
        if warehouse_id:
            from apps.outlets.models import Outlet

            try:
                attrs['warehouse'] = Outlet.objects.get(id=warehouse_id, tenant=tenant)
            except Outlet.DoesNotExist:
                raise serializers.ValidationError({'warehouse_id': 'Warehouse not found in this tenant.'})
        else:
            attrs['warehouse'] = sale.outlet

        customer_id = attrs.get('customer_id')
        if customer_id:
            from apps.customers.models import Customer

            try:
                attrs['customer'] = Customer.objects.get(id=customer_id, tenant=tenant)
            except Customer.DoesNotExist:
                raise serializers.ValidationError({'customer_id': 'Customer not found in this tenant.'})
        else:
            attrs['customer'] = sale.customer

        if not attrs.get('delivery_address'):
            attrs['delivery_address'] = ''

        return attrs


class AssignDeliveryOrderSerializer(serializers.Serializer):
    vehicle_id = serializers.IntegerField()
    driver_id = serializers.IntegerField()


class StartTripSerializer(serializers.Serializer):
    pass


class ConfirmDeliverySerializer(serializers.Serializer):
    fuel_cost = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    distance_km = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)


class CancelDeliverySerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)
