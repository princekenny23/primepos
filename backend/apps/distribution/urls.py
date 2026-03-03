from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DeliveryOrderViewSet, DriverViewSet, TripViewSet, VehicleViewSet

router = DefaultRouter()
router.register(r'distribution/vehicles', VehicleViewSet, basename='distribution-vehicle')
router.register(r'distribution/drivers', DriverViewSet, basename='distribution-driver')
router.register(r'distribution/delivery-orders', DeliveryOrderViewSet, basename='distribution-delivery-order')
router.register(r'distribution/deliveries', DeliveryOrderViewSet, basename='distribution-delivery-legacy')
router.register(r'distribution/trips', TripViewSet, basename='distribution-trip')

urlpatterns = [
    path('', include(router.urls)),
]
