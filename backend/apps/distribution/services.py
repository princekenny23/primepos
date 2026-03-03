from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from apps.inventory.models import StockMovement

from .models import DeliveryOrder, DeliveryOrderItem, Driver, Trip, Vehicle


ACTIVE_RESERVATION_STATUSES = {
    DeliveryOrder.STATUS_PENDING,
    DeliveryOrder.STATUS_ASSIGNED,
    DeliveryOrder.STATUS_IN_TRANSIT,
}


class DistributionService:
    @staticmethod
    def _reserved_quantity(tenant, warehouse, product, exclude_order_id=None):
        queryset = DeliveryOrderItem.objects.filter(
            tenant=tenant,
            product=product,
            is_released=False,
            is_deducted=False,
            delivery_order__warehouse=warehouse,
            delivery_order__delivery_status__in=ACTIVE_RESERVATION_STATUSES,
        )
        if exclude_order_id:
            queryset = queryset.exclude(delivery_order_id=exclude_order_id)
        return queryset.aggregate(total=Sum('quantity')).get('total') or 0

    @staticmethod
    @transaction.atomic
    def reserve_stock_for_delivery_order(delivery_order: DeliveryOrder):
        if delivery_order.items.exists():
            return delivery_order

        sale_items = delivery_order.sales_order.items.select_related('product').all()
        if not sale_items:
            raise serializers.ValidationError({'sales_order_id': 'Sales order has no items to reserve.'})

        to_create = []
        for sale_item in sale_items:
            product = sale_item.product
            if not product:
                raise serializers.ValidationError({'sales_order_id': f'Sale item {sale_item.id} has no product.'})

            required_qty = int(sale_item.quantity_in_base_units or sale_item.quantity or 0)
            if required_qty <= 0:
                raise serializers.ValidationError({'sales_order_id': f'Invalid quantity for product {product.name}.'})

            reserved_qty = DistributionService._reserved_quantity(
                tenant=delivery_order.tenant,
                warehouse=delivery_order.warehouse,
                product=product,
                exclude_order_id=delivery_order.id,
            )
            available_for_reserve = int(product.stock) - int(reserved_qty)
            if available_for_reserve < required_qty:
                raise serializers.ValidationError(
                    {
                        'stock': (
                            f'Insufficient reservable stock for {product.name}. '
                            f'Available: {available_for_reserve}, Required: {required_qty}.'
                        )
                    }
                )

            to_create.append(
                DeliveryOrderItem(
                    tenant=delivery_order.tenant,
                    delivery_order=delivery_order,
                    sale_item=sale_item,
                    product=product,
                    quantity=required_qty,
                )
            )

        DeliveryOrderItem.objects.bulk_create(to_create)
        return delivery_order

    @staticmethod
    @transaction.atomic
    def assign_resources(delivery_order: DeliveryOrder, vehicle: Vehicle, driver: Driver):
        if delivery_order.delivery_status in {DeliveryOrder.STATUS_DELIVERED, DeliveryOrder.STATUS_CANCELLED}:
            raise serializers.ValidationError({'delivery_status': 'Cannot assign resources to completed/cancelled order.'})

        if vehicle.tenant_id != delivery_order.tenant_id:
            raise serializers.ValidationError({'vehicle_id': 'Vehicle must belong to the same tenant.'})
        if driver.tenant_id != delivery_order.tenant_id:
            raise serializers.ValidationError({'driver_id': 'Driver must belong to the same tenant.'})

        if vehicle.status != Vehicle.STATUS_AVAILABLE:
            raise serializers.ValidationError({'vehicle_id': 'Vehicle is not available.'})
        if driver.status != Driver.STATUS_AVAILABLE:
            raise serializers.ValidationError({'driver_id': 'Driver is not available.'})

        previous_vehicle = delivery_order.assigned_vehicle
        previous_driver = delivery_order.assigned_driver

        delivery_order.assigned_vehicle = vehicle
        delivery_order.assigned_driver = driver
        delivery_order.delivery_status = DeliveryOrder.STATUS_ASSIGNED
        delivery_order.save(update_fields=['assigned_vehicle', 'assigned_driver', 'delivery_status', 'updated_at'])

        vehicle.status = Vehicle.STATUS_ON_TRIP
        vehicle.save(update_fields=['status', 'updated_at'])

        driver.status = Driver.STATUS_ON_TRIP
        driver.save(update_fields=['status', 'updated_at'])

        if previous_vehicle and previous_vehicle.id != vehicle.id:
            previous_vehicle.status = Vehicle.STATUS_AVAILABLE
            previous_vehicle.save(update_fields=['status', 'updated_at'])

        if previous_driver and previous_driver.id != driver.id:
            previous_driver.status = Driver.STATUS_AVAILABLE
            previous_driver.save(update_fields=['status', 'updated_at'])

        return delivery_order

    @staticmethod
    @transaction.atomic
    def start_trip(delivery_order: DeliveryOrder):
        if delivery_order.delivery_status not in {DeliveryOrder.STATUS_ASSIGNED, DeliveryOrder.STATUS_IN_TRANSIT}:
            raise serializers.ValidationError({'delivery_status': 'Only assigned orders can start a trip.'})

        if not delivery_order.assigned_vehicle_id or not delivery_order.assigned_driver_id:
            raise serializers.ValidationError({'assignment': 'Vehicle and driver must be assigned before starting trip.'})

        if not delivery_order.trip_start_time:
            delivery_order.trip_start_time = timezone.now()
        delivery_order.delivery_status = DeliveryOrder.STATUS_IN_TRANSIT
        delivery_order.save(update_fields=['trip_start_time', 'delivery_status', 'updated_at'])
        return delivery_order

    @staticmethod
    @transaction.atomic
    def release_reserved_stock(delivery_order: DeliveryOrder):
        DeliveryOrderItem.objects.filter(
            delivery_order=delivery_order,
            is_released=False,
            is_deducted=False,
        ).update(is_released=True, updated_at=timezone.now())

        if not delivery_order.reservation_released_at:
            delivery_order.reservation_released_at = timezone.now()
            delivery_order.save(update_fields=['reservation_released_at', 'updated_at'])

    @staticmethod
    @transaction.atomic
    def deduct_reserved_stock(delivery_order: DeliveryOrder, user):
        if delivery_order.reserved_deducted_at:
            return

        items = DeliveryOrderItem.objects.select_for_update().select_related('product').filter(
            delivery_order=delivery_order,
            is_released=False,
            is_deducted=False,
        )

        if not items.exists():
            raise serializers.ValidationError({'stock': 'No reserved stock to deduct for this delivery order.'})

        for item in items:
            product = item.product
            if int(product.stock) < int(item.quantity):
                raise serializers.ValidationError(
                    {
                        'stock': (
                            f'Insufficient stock at confirmation for {product.name}. '
                            f'Available: {product.stock}, Required: {item.quantity}.'
                        )
                    }
                )

            product.stock = int(product.stock) - int(item.quantity)
            product.save(update_fields=['stock'])

            StockMovement.objects.create(
                tenant=delivery_order.tenant,
                product=product,
                outlet=delivery_order.warehouse,
                user=user,
                movement_type='sale',
                quantity=item.quantity,
                reference_id=f'delivery-order:{delivery_order.id}',
                reason=f'Delivery confirmation for sale {delivery_order.sales_order.receipt_number}',
            )

            item.is_deducted = True
            item.save(update_fields=['is_deducted', 'updated_at'])

        delivery_order.reserved_deducted_at = timezone.now()
        delivery_order.save(update_fields=['reserved_deducted_at', 'updated_at'])

    @staticmethod
    @transaction.atomic
    def confirm_delivery(delivery_order: DeliveryOrder, user, fuel_cost=None, distance_km=None):
        if delivery_order.delivery_status == DeliveryOrder.STATUS_CANCELLED:
            raise serializers.ValidationError({'delivery_status': 'Cannot confirm a cancelled delivery order.'})

        if delivery_order.delivery_status == DeliveryOrder.STATUS_DELIVERED:
            return delivery_order

        if not delivery_order.trip_start_time:
            delivery_order.trip_start_time = timezone.now()

        delivery_order.delivery_status = DeliveryOrder.STATUS_DELIVERED
        delivery_order.trip_end_time = timezone.now()
        delivery_order.save(update_fields=['delivery_status', 'trip_start_time', 'trip_end_time', 'updated_at'])

        DistributionService.deduct_reserved_stock(delivery_order, user=user)

        if delivery_order.assigned_vehicle_id:
            vehicle = delivery_order.assigned_vehicle
            vehicle.status = Vehicle.STATUS_AVAILABLE
            vehicle.save(update_fields=['status', 'updated_at'])

        if delivery_order.assigned_driver_id:
            driver = delivery_order.assigned_driver
            driver.status = Driver.STATUS_AVAILABLE
            driver.save(update_fields=['status', 'updated_at'])

        resolved_fuel_cost = Decimal(str(fuel_cost if fuel_cost is not None else 0))
        resolved_distance_km = Decimal(str(distance_km if distance_km is not None else 0))
        total_cost = resolved_fuel_cost
        profit = Decimal(str(delivery_order.sales_order.total)) - total_cost

        Trip.objects.update_or_create(
            tenant=delivery_order.tenant,
            delivery_order=delivery_order,
            defaults={
                'vehicle': delivery_order.assigned_vehicle,
                'driver': delivery_order.assigned_driver,
                'fuel_cost': resolved_fuel_cost,
                'distance_km': resolved_distance_km,
                'total_cost': total_cost,
                'profit': profit,
            },
        )

        return delivery_order

    @staticmethod
    @transaction.atomic
    def cancel_delivery(delivery_order: DeliveryOrder):
        if delivery_order.delivery_status == DeliveryOrder.STATUS_DELIVERED:
            raise serializers.ValidationError({'delivery_status': 'Cannot cancel a delivered order.'})

        delivery_order.delivery_status = DeliveryOrder.STATUS_CANCELLED
        if not delivery_order.trip_end_time:
            delivery_order.trip_end_time = timezone.now()
        delivery_order.save(update_fields=['delivery_status', 'trip_end_time', 'updated_at'])

        DistributionService.release_reserved_stock(delivery_order)

        if delivery_order.assigned_vehicle_id:
            vehicle = delivery_order.assigned_vehicle
            vehicle.status = Vehicle.STATUS_AVAILABLE
            vehicle.save(update_fields=['status', 'updated_at'])

        if delivery_order.assigned_driver_id:
            driver = delivery_order.assigned_driver
            driver.status = Driver.STATUS_AVAILABLE
            driver.save(update_fields=['status', 'updated_at'])

        return delivery_order
