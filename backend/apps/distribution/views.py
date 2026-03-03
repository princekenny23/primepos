from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.tenants.permissions import TenantFilterMixin
from .models import DeliveryOrder, Driver, Trip, Vehicle
from .permissions import HasDistributionFeature, get_effective_role
from .serializers import (
    AssignDeliveryOrderSerializer,
    CancelDeliverySerializer,
    ConfirmDeliverySerializer,
    CreateDeliveryOrderFromSaleSerializer,
    DeliveryOrderSerializer,
    DriverSerializer,
    StartTripSerializer,
    TripSerializer,
    VehicleSerializer,
)
from .services import DistributionService


class DistributionBaseViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasDistributionFeature]

    def get_queryset(self):
        tenant = self.get_tenant()
        queryset = self.queryset
        if queryset is None:
            return queryset
        return queryset.filter(tenant=tenant)

    def get_tenant(self):
        tenant = getattr(self.request, 'tenant', None) or getattr(self.request.user, 'tenant', None)
        if not tenant:
            raise PermissionDenied('Tenant context is required.')
        return tenant

    def perform_create(self, serializer):
        serializer.save(tenant=self.get_tenant())


class VehicleViewSet(DistributionBaseViewSet):
    queryset = Vehicle.objects.select_related('tenant').all()
    serializer_class = VehicleSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'status', 'fuel_type']
    search_fields = ['plate_number', 'make', 'model']
    ordering_fields = ['created_at', 'plate_number']
    ordering = ['plate_number']

    @action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        queryset = self.filter_queryset(self.get_queryset().filter(status=Vehicle.STATUS_AVAILABLE, is_active=True))
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class DriverViewSet(DistributionBaseViewSet):
    queryset = Driver.objects.select_related('tenant').all()
    serializer_class = DriverSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['name', 'phone', 'license_number', 'id_number']
    ordering_fields = ['created_at', 'name']
    ordering = ['name']

    @action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        queryset = self.filter_queryset(self.get_queryset().filter(status=Driver.STATUS_AVAILABLE))
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class DeliveryOrderViewSet(DistributionBaseViewSet):
    queryset = DeliveryOrder.objects.select_related(
        'tenant', 'sales_order', 'warehouse', 'customer', 'assigned_vehicle', 'assigned_driver', 'created_by'
    ).all()
    serializer_class = DeliveryOrderSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['delivery_status', 'assigned_driver', 'assigned_vehicle', 'sales_order', 'warehouse']
    search_fields = ['sales_order__receipt_number', 'assigned_driver__name', 'assigned_vehicle__plate_number']
    ordering_fields = ['created_at', 'updated_at', 'delivery_status']
    ordering = ['-created_at']

    def get_queryset(self):
        return super().get_queryset()

    def perform_create(self, serializer):
        delivery_order = serializer.save(tenant=self.get_tenant(), created_by=self.request.user)
        DistributionService.reserve_stock_for_delivery_order(delivery_order)

    @action(detail=False, methods=['post'], url_path='create-from-sale')
    def create_from_sale(self, request):
        role = get_effective_role(request.user)
        if role == 'driver':
            raise PermissionDenied('Drivers cannot create delivery orders.')

        serializer = CreateDeliveryOrderFromSaleSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        delivery_order = DeliveryOrder.objects.create(
            tenant=self.get_tenant(),
            sales_order=serializer.validated_data['sale'],
            warehouse=serializer.validated_data['warehouse'],
            customer=serializer.validated_data.get('customer'),
            delivery_address=serializer.validated_data.get('delivery_address', ''),
            delivery_status=DeliveryOrder.STATUS_PENDING,
            created_by=request.user,
        )
        DistributionService.reserve_stock_for_delivery_order(delivery_order)

        return Response(DeliveryOrderSerializer(delivery_order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='assign')
    def assign(self, request, pk=None):
        delivery_order = self.get_object()
        serializer = AssignDeliveryOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant = self.get_tenant()
        try:
            vehicle = Vehicle.objects.get(id=serializer.validated_data['vehicle_id'], tenant=tenant)
        except Vehicle.DoesNotExist:
            return Response({'vehicle_id': 'Vehicle not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            driver = Driver.objects.get(id=serializer.validated_data['driver_id'], tenant=tenant)
        except Driver.DoesNotExist:
            return Response({'driver_id': 'Driver not found.'}, status=status.HTTP_404_NOT_FOUND)

        delivery_order = DistributionService.assign_resources(delivery_order, vehicle, driver)
        return Response(DeliveryOrderSerializer(delivery_order).data)

    @action(detail=True, methods=['post'], url_path='start-trip')
    def start_trip(self, request, pk=None):
        delivery_order = self.get_object()
        serializer = StartTripSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delivery_order = DistributionService.start_trip(delivery_order)
        return Response(DeliveryOrderSerializer(delivery_order).data)

    @action(detail=True, methods=['post'], url_path='confirm-delivery')
    def confirm_delivery(self, request, pk=None):
        delivery_order = self.get_object()
        serializer = ConfirmDeliverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delivery_order = DistributionService.confirm_delivery(
            delivery_order,
            user=request.user,
            fuel_cost=serializer.validated_data.get('fuel_cost'),
            distance_km=serializer.validated_data.get('distance_km'),
        )
        return Response(DeliveryOrderSerializer(delivery_order).data)

    @action(detail=True, methods=['post'], url_path='cancel-delivery')
    def cancel_delivery(self, request, pk=None):
        delivery_order = self.get_object()
        serializer = CancelDeliverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delivery_order = DistributionService.cancel_delivery(delivery_order)
        return Response(DeliveryOrderSerializer(delivery_order).data)


class TripViewSet(DistributionBaseViewSet):
    queryset = Trip.objects.select_related('tenant', 'delivery_order', 'vehicle', 'driver').all()
    serializer_class = TripSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['vehicle', 'driver', 'delivery_order']
    search_fields = ['delivery_order__sales_order__receipt_number', 'vehicle__plate_number', 'driver__name']
    ordering_fields = ['created_at', 'updated_at', 'total_cost', 'profit']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'], url_path='active')
    def active_trips(self, request):
        active_orders = DeliveryOrder.objects.select_related('sales_order', 'assigned_vehicle', 'assigned_driver').filter(
            tenant=self.get_tenant(),
            delivery_status__in=[DeliveryOrder.STATUS_ASSIGNED, DeliveryOrder.STATUS_IN_TRANSIT],
        ).order_by('-updated_at')

        payload = [
            {
                'id': order.id,
                'delivery_order': order.id,
                'delivery_order_reference': {
                    'id': order.id,
                    'sales_order_id': order.sales_order_id,
                    'receipt_number': order.sales_order.receipt_number,
                    'delivery_status': order.delivery_status,
                },
                'vehicle_plate_number': order.assigned_vehicle.plate_number if order.assigned_vehicle else None,
                'driver_name': order.assigned_driver.name if order.assigned_driver else None,
                'total_cost': '0.00',
            }
            for order in active_orders
        ]

        return Response(payload)
